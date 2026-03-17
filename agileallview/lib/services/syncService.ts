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
  teamsRepo, iterationsRepo, workItemsRepo, revisionsRepo, metricsRepo,
  capacityRepo, capacityOverridesRepo, membersRepo, tasksRepo, syncStateRepo, workItemChildrenRepo,
} from "@/lib/storage/repositories";
import { processRevisionsWithDates, calcCapacityWithDayOffs, weekKey } from "../analytics/engine";
import type { Team, Revision, CapacityRow, Metric } from "../types";

const MAX_CONCURRENT_REVISIONS = 5;

const PBI_CORE_FIELDS = [
  "System.Id", "System.Title", "System.State", "System.WorkItemType",
  "System.CreatedDate", "System.ChangedDate", "System.AssignedTo",
  "System.IterationPath", "System.AreaPath",
  "System.BoardColumn",
  "Microsoft.VSTS.Common.ClosedDate",
  "Microsoft.VSTS.Scheduling.Effort",
  "Microsoft.VSTS.Common.Activity",
];

// Optional fields: may not exist in every organisation/process. We will try them
// and fall back to core fields on error.
const PBI_OPTIONAL_FIELDS = [
  "System.BoardColumnDone",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.Common.Severity",
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
  "Bug",
  "Defect",
];

const TASK_FIELDS = [
  "System.Id", "System.State", "System.AssignedTo", "System.ChangedDate",
  "System.IterationPath", "Microsoft.VSTS.Scheduling.RemainingWork",
  "Microsoft.VSTS.Scheduling.CompletedWork",
  "Microsoft.VSTS.Scheduling.OriginalEstimate",
];

const CHILD_FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.State",
  "System.AssignedTo",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.Common.Severity",
  "Microsoft.VSTS.Scheduling.RemainingWork",
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

    // ── 3. Capacity for last 6 sprints (+ a few future) ───────────
    prog("capacity", "Buscando capacidade das sprints...", 15);
    const sortedIterations = [...iterations].sort((a, b) => {
      const at = a.start_date ? new Date(a.start_date).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.start_date ? new Date(b.start_date).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });

    const pastAndCurrent = sortedIterations.filter((s) => s.time_frame !== "future").slice(-6);
    const future = sortedIterations.filter((s) => s.time_frame === "future").slice(0, 4);
    const recentSprints = [...pastAndCurrent, ...future];
    for (const sprint of recentSprints) {
      const rawCap = await api.getCapacity(team.org, team.project, team.team_name, sprint.id);
      if (!rawCap.length) {
        if (sprint.time_frame === "current") {
          console.warn("[sync] capacity empty for current sprint", {
            teamId: team.id,
            teamName: team.team_name,
            org: team.org,
            project: team.project,
            sprintId: sprint.id,
            sprintName: sprint.name,
          });
        }
        continue;
      }

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

      // Reconcile overrides (best-effort): if Azure == manual, clear dirty flag
      const overrides = capacityOverridesRepo.byIteration(team.id, sprint.id);
      if (overrides.length) {
        const azureDailyByMember = new Map<string, number>();
        for (const c of rawCap) {
          const memberId = c.teamMember?.id ?? "";
          if (!memberId) continue;
          const daily = (c.activities ?? []).reduce((s, a: any) => s + (a.capacityPerDay ?? 0), 0);
          azureDailyByMember.set(memberId, daily);
        }

        for (const ov of overrides) {
          const azureDaily = azureDailyByMember.get(ov.member_id);
          if (azureDaily == null) continue;
          const manual = ov.override_hours_per_day;
          if (manual == null) continue;
          const equal = Math.abs(manual - azureDaily) < 0.001;
          if (equal && ov.is_dirty) {
            capacityOverridesRepo.upsert({ ...ov, is_dirty: 0 });
          }
        }
      }
    }

    // ── 4. WIQL — PBI IDs (incremental) ──────────────────────────
    prog("wiql", "Buscando IDs dos PBIs via WIQL...", 20);
    const syncState = syncStateRepo.get(team.id);
    const lastSync  = syncState?.last_sync ?? null;
    const dateFilter = lastSync ? `AND [System.ChangedDate] >= '${lastSync}'` : "";

    const pbiIds = await wiqlPbiIdsWithFallback(api, team.org, team.project, dateFilter);

    // For incremental syncs, a PBI may have children (Tasks/Bugs) even if it
    // didn't change recently. To keep the expandable view accurate without
    // forcing a full sync, also fetch currently-open PBIs and refresh their
    // relations.
    const openPbiIds = lastSync
      ? await wiqlOpenPbiIdsWithFallback(api, team.org, team.project)
      : [];

    // Extra safety: some orgs use different backlog item types / states.
    // If WIQL misses them, we still want child relations for items already
    // present locally and currently open.
    const localOpenIds = lastSync
      ? workItemsRepo
          .byTeam(team.id)
          .filter((w) => {
            const type = (w.work_item_type ?? "").trim();
            if (type === "Task" || type === "Bug") return false;
            const st = (w.state ?? "").trim();
            if (!st) return true;
            return st !== "Done" && st !== "Removed";
          })
          .slice(0, 1500)
          .map((w) => w.id)
      : [];

    const allPbiIds = Array.from(new Set<number>([...pbiIds, ...openPbiIds, ...localOpenIds]));

    // ── 5. Work item details ──────────────────────────────────────
    prog("workitems", `Buscando detalhes de ${allPbiIds.length} PBIs...`, 25);
    const rawItems = await getWorkItemsBatchWithFallback(api, team.org, allPbiIds, { expandRelations: true });

    workItemsRepo.upsertBulk(rawItems.map((wi) => ({
      id: wi.id,
      team_id: team.id,
      title:          str(wi.fields["System.Title"]),
      state:          str(wi.fields["System.State"]),
      board_column:   str(wi.fields["System.BoardColumn"]) ?? null,
      board_column_done: wi.fields["System.BoardColumnDone"] === true ? 1 : wi.fields["System.BoardColumnDone"] === false ? 0 : null,
      priority:       num(wi.fields["Microsoft.VSTS.Common.Priority"]),
      severity:       str(wi.fields["Microsoft.VSTS.Common.Severity"]) ?? null,
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

    // ── 5b. Children (Tasks/Bugs) via relations ───────────────────
    prog("children", "Buscando Tasks/Bugs filhos dos PBIs...", 30);
    let totalRelations = 0;
    let hierarchyRelations = 0;
    const parentToChildren = new Map<number, number[]>();
    const allChildIds = new Set<number>();
    for (const wi of rawItems) {
      const rels = wi.relations ?? [];
      totalRelations += rels.length;
      for (const r of rels) {
        const rel = (r.rel ?? "").toLowerCase();
        if (rel !== "system.linktypes.hierarchy-forward") continue;
        hierarchyRelations++;
        const id = extractWorkItemIdFromUrl(r.url);
        if (!id) continue;
        const arr = parentToChildren.get(wi.id) ?? [];
        arr.push(id);
        parentToChildren.set(wi.id, arr);
        allChildIds.add(id);
      }
    }

    const parentIds = Array.from(parentToChildren.keys());
    if (parentIds.length) {
      workItemChildrenRepo.deleteByParents(parentIds);
    }

    const childIds = Array.from(allChildIds);
    if (childIds.length) {
      const rawChildren = await api.getWorkItemsBatch(team.org, childIds, CHILD_FIELDS);
      const childMap = new Map(rawChildren.map((c) => [c.id, c] as const));

      const rows: { parent_id: number; child_id: number; child_type?: string | null; title?: string | null; assigned_to?: string | null; state?: string | null; priority?: number | null; severity?: string | null; remaining_work?: number | null }[] = [];
      for (const [parentId, ids] of Array.from(parentToChildren.entries())) {
        for (const childId of Array.from(new Set(ids))) {
          const c = childMap.get(childId);
          if (!c) continue;
          const type = str(c.fields["System.WorkItemType"]) ?? null;
          // Only keep Tasks/Bugs/Defects
          if (type !== "Task" && type !== "Bug" && type !== "Defect") continue;
          rows.push({
            parent_id: parentId,
            child_id: childId,
            child_type: type,
            title: str(c.fields["System.Title"]) ?? null,
            assigned_to: assignedTo(c.fields["System.AssignedTo"]) ?? null,
            state: str(c.fields["System.State"]) ?? null,
            priority: num(c.fields["Microsoft.VSTS.Common.Priority"]),
            severity: str(c.fields["Microsoft.VSTS.Common.Severity"]) ?? null,
            remaining_work: num(c.fields["Microsoft.VSTS.Scheduling.RemainingWork"]),
          });
        }
      }

      const nullState = rows.filter((r) => !String(r.state ?? "").trim()).length;
      const byState: Record<string, number> = {};
      for (const r of rows) {
        const s = String(r.state ?? "").trim() || "(null)";
        byState[s] = (byState[s] ?? 0) + 1;
      }
      console.log(
        `[children] stateDistribution null=${nullState}/${rows.length} top=${Object.entries(byState)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([s, n]) => `${s}:${n}`)
          .join(", ")}`
      );
      workItemChildrenRepo.upsertBulk(rows);
      console.log(
        `[children] rawItems=${rawItems.length} totalRelations=${totalRelations} hierarchyRelations=${hierarchyRelations} parentsWithChildren=${parentToChildren.size} childIds=${childIds.length} rowsInserted=${rows.length}`
      );
    } else {
      console.log(
        `[children] rawItems=${rawItems.length} totalRelations=${totalRelations} hierarchyRelations=${hierarchyRelations} parentsWithChildren=${parentToChildren.size} childIds=0 rowsInserted=0`
      );
    }

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
        processRevisionsWithDates(revs, { createdDate: wi.created_date ?? null, closedDate: wi.closed_date ?? null });
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
    const nonFutureSprints = iterations.filter((s) => s.time_frame !== "future");
    const lastSix = nonFutureSprints.slice(-6);
    const fallbackSince = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
    const sinceDate = (lastSix.find((s) => s.start_date)?.start_date ?? lastSix[0]?.start_date ?? fallbackSince) as string;

    const taskQuery = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.WorkItemType] = 'Task'
        AND [System.TeamProject] = '${team.project}'
        AND [System.ChangedDate] >= '${sinceDate}'
      ORDER BY [System.ChangedDate] DESC
    `;
    const taskIds = await api.wiql(team.org, team.project, taskQuery).catch(() => [] as number[]);
    if (taskIds.length) {
      const rawTasks = await api.getWorkItemsBatch(team.org, taskIds, TASK_FIELDS);
      tasksRepo.upsertBulk(rawTasks.map((t) => ({
        id: t.id,
        team_id: team.id,
        assigned_to:    assignedTo(t.fields["System.AssignedTo"]),
        state:          str(t.fields["System.State"]),
        remaining_work: num(t.fields["Microsoft.VSTS.Scheduling.RemainingWork"]) ?? 0,
        completed_work: num(t.fields["Microsoft.VSTS.Scheduling.CompletedWork"]) ?? 0,
        original_estimate: num(t.fields["Microsoft.VSTS.Scheduling.OriginalEstimate"]) ?? 0,
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
  const set = new Set<number>();
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
      for (const id of ids) set.add(id);
    } catch (e) {
      console.warn(`WIQL failed for work item type '${typeName}':`, e);
    }
  }

  const merged = Array.from(set);
  if (merged.length) return merged;

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

async function wiqlOpenPbiIdsWithFallback(
  api: AzureConnector,
  org: string,
  project: string
): Promise<number[]> {
  const set = new Set<number>();
  for (const typeName of DEFAULT_PBI_WORK_ITEM_TYPES) {
    const wiqlQuery = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.TeamProject] = '${project}'
        AND [System.WorkItemType] = '${typeName}'
        AND [System.State] <> 'Done'
        AND [System.State] <> 'Removed'
      ORDER BY [System.ChangedDate] DESC
    `;
    try {
      const ids = await api.wiql(org, project, wiqlQuery);
      for (const id of ids) set.add(id);
    } catch (e) {
      console.warn(`WIQL open items failed for work item type '${typeName}':`, e);
    }
  }

  const merged = Array.from(set);
  if (merged.length) return merged;

  const lastWiql = `
    SELECT [System.Id] FROM WorkItems
    WHERE [System.TeamProject] = '${project}'
      AND [System.WorkItemType] = 'Product Backlog Item'
      AND [System.State] <> 'Done'
      AND [System.State] <> 'Removed'
    ORDER BY [System.ChangedDate] DESC
  `;
  return await api.wiql(org, project, lastWiql);
}

async function getWorkItemsBatchWithFallback(
  api: AzureConnector,
  org: string,
  ids: number[],
  options?: { expandRelations?: boolean }
) {
  try {
    return await api.getWorkItemsBatch(org, ids, [...PBI_CORE_FIELDS, ...PBI_OPTIONAL_FIELDS], options);
  } catch (e) {
    console.warn("getWorkItemsBatch failed with optional fields; retrying with core fields only:", e);
    return await api.getWorkItemsBatch(org, ids, PBI_CORE_FIELDS, options);
  }
}

function extractWorkItemIdFromUrl(url: string): number | null {
  const m = url.match(/workItems\/(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
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
