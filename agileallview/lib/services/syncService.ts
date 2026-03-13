/**
 * lib/services/syncService.ts
 * Orchestrates the full ingestion pipeline for a team.
 * Runs server-side only (uses SQLite and fetch with PAT).
 *
 * Flow:
 *   1. Validate PAT / sprints
 *   2. Fetch members + capacity
 *   3. WIQL → PBI IDs
 *   4. Work items batch
 *   5. Revisions (concurrent, throttled)
 *   6. Compute metrics → persist
 *   7. WIQL → Task IDs → task details
 *   8. Update sync_state
 */
import { AzureConnector } from "../azure/connector";
import {
  iterationsRepo, workItemsRepo, revisionsRepo,
  metricsRepo, capacityRepo, membersRepo, tasksRepo, syncStateRepo,
} from "../storage/repositories";
import { processRevisions, calcCapacityWithDayOffs, weekKey } from "../analytics/engine";
import type { Team, Revision, CapacityRow, Metric } from "../types";

const MAX_CONCURRENT_REVISIONS = 5;

const PBI_CORE_FIELDS = [
  "System.Id", "System.Title", "System.State", "System.WorkItemType",
  "System.CreatedDate", "System.ChangedDate", "System.AssignedTo",
  "System.IterationPath", "System.AreaPath",
  "Microsoft.VSTS.Common.ClosedDate",
  "Microsoft.VSTS.Scheduling.Effort",
  "Microsoft.VSTS.Common.Activity",
];

// Optional fields: may not exist in every organisation/process. We will try them
// and fall back to core fields on error.
const PBI_OPTIONAL_FIELDS = [
  // Legacy custom fields
  "Custom.Block",
  "Custom.TipoDoBloqueio",
  "Custom.Bloqueio",
  "Custom.MotivoDoBloqueio",
  "Custom.Produto",
  "Custom.Tecnologia",
  "Custom.NumberMTI",
  // DoR / DoD checklists (store raw text for now)
  "Custom.DoR",
  "Custom.DOR",
  "Custom.DoD",
  "Custom.DOD",
  "Custom.DefinitionOfReady",
  "Custom.DefinitionOfDone",
];

const DEFAULT_PBI_WORK_ITEM_TYPES = [
  "Product Backlog Item",
  "User Story",
];

const TASK_FIELDS = [
  "System.Id", "System.State", "System.AssignedTo", "System.ChangedDate",
  "System.IterationPath", "Microsoft.VSTS.Scheduling.RemainingWork",
];

export type ProgressCallback = (step: string, msg: string, pct: number) => void;

export async function syncTeam(
  team: Team,
  pat: string,
  onProgress?: ProgressCallback
): Promise<{ itemCount: number; tasksCount: number }> {
  const api = new AzureConnector(pat);
  const prog = (s: string, m: string, p: number) => onProgress?.(s, m, p);

  // Mark as running
  syncStateRepo.set(team.id, { status: "running", error_msg: null });

  try {
    // ── 1. Sprints ────────────────────────────────────────────────
    prog("sprints", "Buscando sprints...", 5);
    const rawIterations = await api.getIterations(team.org, team.project, team.team_name);
    const iterations = rawIterations.map((it) => ({
      id: it.id,
      team_id: team.id,
      name: it.name,
      path: it.path ?? undefined,
      start_date: it.attributes?.startDate ?? null,
      finish_date: it.attributes?.finishDate ?? null,
      time_frame: it.attributes?.timeFrame ?? "past",
    }));
    iterationsRepo.upsertBulk(iterations);

    // ── 2. Members ────────────────────────────────────────────────
    prog("members", "Buscando membros do time...", 10);
    const rawMembers = await api.getMembers(team.org, team.project, team.team_name).catch(() => []);
    membersRepo.upsertBulk(rawMembers.map((m) => ({ id: m.id, team_id: team.id, display_name: m.displayName, unique_name: m.uniqueName })));

    // ── 3. Capacity for last 6 sprints ────────────────────────────
    prog("capacity", "Buscando capacidade das sprints...", 15);
    const recentSprints = iterations.filter((s) => s.time_frame !== "future").slice(-6);
    for (const sprint of recentSprints) {
      const rawCap = await api.getCapacity(team.org, team.project, team.team_name, sprint.id);
      if (!rawCap.length) continue;

      const withDayOffs = calcCapacityWithDayOffs(
        rawCap.map((c) => ({
          memberId: c.teamMember?.id ?? "",
          memberName: c.teamMember?.displayName ?? "?",
          activities: c.activities ?? [],
          daysOff: c.daysOff ?? [],
          totalCapacity: 0,
          realCapacity: 0,
          workingDays: 0,
          dayOffCount: 0,
        })),
        sprint.start_date,
        sprint.finish_date
      );

      const capRows: CapacityRow[] = withDayOffs.map((m) => ({
        team_id: team.id,
        iteration_id: sprint.id,
        member_id: m.memberId,
        member_name: m.memberName,
        activities: JSON.stringify(m.activities),
        days_off: JSON.stringify(m.daysOff),
        total_capacity: m.totalCapacity,
        real_capacity: m.realCapacity,
      }));
      capacityRepo.upsertBulk(capRows);
    }

    // ── 4. WIQL — PBI IDs (incremental) ──────────────────────────
    prog("wiql", "Buscando IDs dos PBIs via WIQL...", 20);
    const syncState = syncStateRepo.get(team.id);
    const lastSync  = syncState?.last_sync ?? null;
    const dateFilter = lastSync ? `AND [System.ChangedDate] >= '${lastSync}'` : "";

    const pbiIds = await wiqlPbiIdsWithFallback(api, team.org, team.project, dateFilter);

    // ── 5. Work item details ──────────────────────────────────────
    prog("workitems", `Buscando detalhes de ${pbiIds.length} PBIs...`, 25);
    const rawItems = await getWorkItemsBatchWithFallback(api, team.org, pbiIds);

    workItemsRepo.upsertBulk(rawItems.map((wi) => ({
      id: wi.id,
      team_id: team.id,
      title:          str(wi.fields["System.Title"]),
      state:          str(wi.fields["System.State"]),
      work_item_type: str(wi.fields["System.WorkItemType"]) ?? "Product Backlog Item",
      created_date:   str(wi.fields["System.CreatedDate"]),
      changed_date:   str(wi.fields["System.ChangedDate"]),
      closed_date:    str(wi.fields["Microsoft.VSTS.Common.ClosedDate"]) ?? null,
      assigned_to:    assignedTo(wi.fields["System.AssignedTo"]),
      iteration_path: str(wi.fields["System.IterationPath"]),
      iteration_name: lastSegment(str(wi.fields["System.IterationPath"])),
      area_path:      str(wi.fields["System.AreaPath"]),
      effort:         num(wi.fields["Microsoft.VSTS.Scheduling.Effort"]),
      activity:       str(wi.fields["Microsoft.VSTS.Common.Activity"]),
      bloqueio:       firstBoolField(wi.fields, ["Custom.Block", "Custom.Bloqueio"]) ? 1 : 0,
      tipo_bloqueio:  firstTextField(wi.fields, ["Custom.TipoDoBloqueio"]) ?? null,
      motivo_bloqueio: firstTextField(wi.fields, ["Custom.MotivoDoBloqueio"]) ?? null,
      produto:        firstTextField(wi.fields, ["Custom.Produto"]) ?? null,
      tecnologia:     firstTextField(wi.fields, ["Custom.Tecnologia"]) ?? null,
      number_mti:     firstTextField(wi.fields, ["Custom.NumberMTI"]) ?? null,
      dor_checklist:  firstTextField(wi.fields, [
        "Custom.DoR",
        "Custom.DOR",
        "Custom.DefinitionOfReady",
      ]),
      dod_checklist:  firstTextField(wi.fields, [
        "Custom.DoD",
        "Custom.DOD",
        "Custom.DefinitionOfDone",
      ]),

    })));

    // ── 6. Revisions (throttled) ──────────────────────────────────
    prog("revisions", `Processando revisões de ${pbiIds.length} itens...`, 35);
    let done = 0;

    await runConcurrent(
      pbiIds.map((id) => async () => {
        try {
          const maxRev = revisionsRepo.maxRev(id);
          // If we already have revisions and this item hasn't changed, skip
          if (maxRev > 0 && lastSync) {
            const wi = rawItems.find((w) => w.id === id);
            if (wi) {
              const changed = str(wi.fields["System.ChangedDate"]);
              if (changed && new Date(changed) <= new Date(lastSync)) return;
            }
          }

          const rawRevs = await api.getRevisions(team.org, id);
          const newRevs: Revision[] = rawRevs
            .filter((r) => r.rev > maxRev)
            .map((r) => ({
              work_item_id: id,
              rev: r.rev,
              state:          str(r.fields["System.State"]),
              assigned_to:    assignedTo(r.fields["System.AssignedTo"]),
              iteration_path: str(r.fields["System.IterationPath"]),
              changed_date:   str(r.fields["System.ChangedDate"]) ?? new Date().toISOString(),
              effort:         num(r.fields["Microsoft.VSTS.Scheduling.Effort"]),
              activity:       str(r.fields["Microsoft.VSTS.Common.Activity"]),
            }));
          revisionsRepo.upsertBulk(newRevs);
        } catch (e) {
          console.warn(`Revision fetch failed for ${id}:`, e);
        } finally {
          done++;
          if (done % 10 === 0) {
            const pct = 35 + Math.round((done / pbiIds.length) * 40);
            prog("revisions", `Revisões: ${done}/${pbiIds.length}`, pct);
          }
        }
      }),
      MAX_CONCURRENT_REVISIONS
    );

    // ── 7. Compute metrics from revisions ─────────────────────────
    prog("metrics", "Calculando métricas...", 78);
    const allWIs = workItemsRepo.byTeam(team.id);
    const metricRows: Metric[] = [];
    for (const wi of allWIs) {
      const revs = revisionsRepo.byWorkItem(wi.id);
      if (!revs.length) continue;
      const { timeline, timeByStatus, leadTime, cycleTime, committedDate, inProgressDate, doneDate } =
        processRevisions(revs);
      metricRows.push({
        work_item_id: wi.id,
        team_id: team.id,
        lead_time: leadTime,
        cycle_time: cycleTime,
        committed_date: committedDate,
        in_progress_date: inProgressDate,
        done_date: doneDate,
        time_by_status: JSON.stringify(timeByStatus),
        status_timeline: JSON.stringify(timeline),
      });
    }
    metricsRepo.upsertBulk(metricRows);

    // ── 8. Tasks for individual capacity ─────────────────────────
    prog("tasks", "Buscando Tasks para capacidade individual...", 85);
    const fourWeeksAgo = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
    const taskQuery = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.WorkItemType] = 'Task'
        AND [System.State] = 'Done'
        AND [System.TeamProject] = '${team.project}'
        AND [System.ChangedDate] >= '${fourWeeksAgo}'
    `;
    const taskIds = await api.wiql(team.org, team.project, taskQuery).catch(() => [] as number[]);
    if (taskIds.length) {
      const rawTasks = await api.getWorkItemsBatch(team.org, taskIds, TASK_FIELDS);
      tasksRepo.upsertBulk(rawTasks.map((t) => ({
        id: t.id,
        team_id: team.id,
        assigned_to:    assignedTo(t.fields["System.AssignedTo"]),
        remaining_work: num(t.fields["Microsoft.VSTS.Scheduling.RemainingWork"]) ?? 0,
        changed_date:   str(t.fields["System.ChangedDate"]),
        iteration_name: lastSegment(str(t.fields["System.IterationPath"])),
        week_key:       weekKey(str(t.fields["System.ChangedDate"]) ?? new Date().toISOString()),
      })));
    }

    // ── 9. Save sync state ────────────────────────────────────────
    syncStateRepo.set(team.id, {
      last_sync:  new Date().toISOString(),
      item_count: allWIs.length,
      status:     "idle",
      error_msg:  null,
    });

    prog("done", "Sincronização concluída!", 100);
    return { itemCount: allWIs.length, tasksCount: taskIds.length };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    syncStateRepo.set(team.id, { status: "error", error_msg: msg });
    throw err;
  }
}

// ─── Concurrency helper ───────────────────────────────────────────

async function runConcurrent(tasks: (() => Promise<void>)[], limit: number) {
  const queue = [...tasks];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const task = queue.shift();
      if (task) await task();
    }
  });
  await Promise.all(workers);
}

// ─── Field extraction helpers ─────────────────────────────────────

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function assignedTo(v: unknown): string {
  if (!v) return "—";
  if (typeof v === "object" && v !== null && "displayName" in v) return (v as { displayName: string }).displayName;
  return String(v);
}

function lastSegment(path?: string): string {
  if (!path) return "—";
  const parts = path.split("\\");
  return parts[parts.length - 1];
}

async function wiqlPbiIdsWithFallback(
  api: AzureConnector,
  org: string,
  project: string,
  dateFilter: string
): Promise<number[]> {
  for (const typeName of DEFAULT_PBI_WORK_ITEM_TYPES) {
    const wiqlQuery = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.TeamProject] = '${project}'
        AND [System.WorkItemType] = '${typeName}'
        ${dateFilter}
      ORDER BY [System.ChangedDate] DESC
    `;

    try {
      const ids = await api.wiql(org, project, wiqlQuery);
      if (ids.length) return ids;
    } catch (e) {
      console.warn(`WIQL failed for work item type '${typeName}':`, e);
    }
  }

  // Last attempt: keep previous behaviour for visibility (may throw)
  const lastWiql = `
    SELECT [System.Id] FROM WorkItems
    WHERE [System.TeamProject] = '${project}'
      AND [System.WorkItemType] = 'Product Backlog Item'
      ${dateFilter}
    ORDER BY [System.ChangedDate] DESC
  `;
  return await api.wiql(org, project, lastWiql);
}

async function getWorkItemsBatchWithFallback(
  api: AzureConnector,
  org: string,
  ids: number[]
) {
  try {
    return await api.getWorkItemsBatch(org, ids, [...PBI_CORE_FIELDS, ...PBI_OPTIONAL_FIELDS]);
  } catch (e) {
    console.warn("getWorkItemsBatch failed with optional fields; retrying with core fields only:", e);
    return await api.getWorkItemsBatch(org, ids, PBI_CORE_FIELDS);
  }
}

function firstTextField(fields: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = fields[k];
    const s = str(v);
    if (s && s.trim()) return s;
  }
  return null;
}

function firstBoolField(fields: Record<string, unknown>, keys: string[]): boolean {
  for (const k of keys) {
    const v = fields[k];
    if (v == null) continue;
    if (bool(v)) return true;
    if (typeof v === "number" && v === 0) return false;
    if (typeof v === "string" && v.trim() === "0") return false;
  }
  return false;
}
