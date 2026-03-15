/**
 * GET /api/metrics/[teamId]?sprints=4
 *
 * Returns everything the dashboard needs:
 *   - sprints (filtered)
 *   - workItems with metrics joined
 *   - sprintMetrics (aggregated per sprint)
 *   - capacity (current sprint)
 *   - individualCapacity
 */
import { NextRequest, NextResponse } from "next/server";
import {
  teamsRepo, iterationsRepo, workItemsRepo, revisionsRepo,
  metricsRepo, capacityRepo, tasksRepo, workItemChildrenRepo,
} from "@/lib/storage/repositories";
import {
  calcIndividualCapacity,
  calcCapacityWithDayOffs,
} from "@/lib/analytics/engine";
import type { Iteration } from "@/lib/types";

const weekStartIso = (dateIso: string): string => {
  const d = new Date(dateIso);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const pct = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
};

export async function GET(req: NextRequest, { params }: { params: { teamId: string } }) {
  const { teamId } = params;
  const url = new URL(req.url);
  const sprintsFilter  = parseInt(url.searchParams.get("sprints") ?? "4");
  const sprintIdsParam = url.searchParams.get("sprintIds");
  const dateFrom       = url.searchParams.get("from");
  const dateTo         = url.searchParams.get("to");
  const openBacklog    = url.searchParams.get("openBacklog") === "1";

  const team = teamsRepo.byId(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // All sprints for this team
  const allSprints = iterationsRepo.byTeam(teamId);
  const nonFutureSprints = allSprints.filter((s) => s.time_frame !== "future");
  const futureSprints = allSprints.filter((s) => s.time_frame === "future");
  const availableSprints = [
    ...nonFutureSprints.slice(-4),
    ...futureSprints.slice(0, 3),
  ].filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx);

  let sprints = allSprints;

  // Apply filter
  if (openBacklog && !sprintIdsParam && !dateFrom && !dateTo) {
    // Open backlog mode: do not slice by period/sprints
    const nonFuture = sprints.filter((s) => s.time_frame !== "future");
    sprints = nonFuture.length ? nonFuture : sprints;
  } else if (sprintIdsParam) {
    const selectedIds = new Set(
      sprintIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    sprints = sprints.filter((s) => selectedIds.has(s.id));
  } else if (dateFrom || dateTo) {
    sprints = sprints.filter((s) => {
      const d = new Date(s.start_date || s.finish_date || 0);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo   && d > new Date(dateTo))   return false;
      return true;
    });
  } else {
    // Avoid returning only future iterations (usually have no PBIs yet)
    const nonFuture = sprints.filter((s) => s.time_frame !== "future");
    sprints = (nonFuture.length ? nonFuture : sprints).slice(-sprintsFilter);
  }

  const sprintNames = new Set(sprints.map((s) => s.name));
  const sprintRanges = sprints
    .map((s) => ({
      name: s.name,
      start: s.start_date ? new Date(s.start_date).getTime() : null,
      finish: s.finish_date ? new Date(s.finish_date).getTime() : null,
    }))
    .filter((r) => r.name);

  const belongsToSelectedSprint = (wi: { iteration_name?: string | null; closed_date?: string | null }) => {
    const closed = wi.closed_date ? new Date(wi.closed_date).getTime() : null;

    // Primary rule: if it closed inside a sprint period, it belongs to that sprint
    if (closed != null) {
      for (const r of sprintRanges) {
        if (r.start == null || r.finish == null) continue;
        if (closed >= r.start && closed <= r.finish) return true;
      }
    }

    // Fallback: if not closed (or sprint dates missing), use iteration assignment
    return Boolean(wi.iteration_name && sprintNames.has(wi.iteration_name));
  };

  // Work items for filtered sprints
  const allWIs = openBacklog
    ? workItemsRepo.byTeam(teamId).filter((w) => w.state !== "Done" && w.state !== "Removed")
    : workItemsRepo.byTeam(teamId).filter(
      (w) => !sprints.length || belongsToSelectedSprint(w as any)
    );

  // Metrics map
  const allMetrics = metricsRepo.byTeam(teamId);
  const metricsMap = new Map(allMetrics.map((m) => [m.work_item_id, m]));

  const workItemDtos = allWIs.map((wi) => {
    const m = metricsMap.get(wi.id);
    return {
      id: wi.id,
      title:      wi.title,
      state:      wi.state,
      boardColumn: (wi as any).board_column ?? null,
      boardColumnDone: (wi as any).board_column_done ?? null,
      priority: (wi as any).priority ?? null,
      severity: (wi as any).severity ?? null,
      workItemType: (wi as any).work_item_type ?? null,
      iteration:  wi.iteration_name,
      assignedTo: wi.assigned_to,
      effort:     wi.effort,
      activity:   wi.activity,
      bloqueio:   Boolean(wi.bloqueio),
      closedDate: wi.closed_date ?? null,
      leadTime:   m?.lead_time ?? null,
      cycleTime:  m?.cycle_time ?? null,
      statusTimeline: m ? JSON.parse(m.status_timeline || "[]") : [],
      timeByStatus:   m ? JSON.parse(m.time_by_status  || "{}") : {},
    };
  });

  const mkDist = (vals: (string | number | null | undefined)[]) => {
    const m: Record<string, number> = {};
    for (const v of vals) {
      const k = (v == null ? "(vazio)" : String(v).trim()) || "(vazio)";
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const defectWIs = allWIs.filter((w: any) => {
    const t = String(w.work_item_type ?? "");
    return t === "Defect" || t === "Bug";
  });
  const childRows = workItemChildrenRepo.byParents(allWIs.map((w) => w.id));
  const bugChildren = childRows.filter((c) => String((c as any).child_type ?? "") === "Bug");
  const defectChildren = childRows.filter((c) => String((c as any).child_type ?? "") === "Defect");

  const isOpen = (st: unknown) => {
    const s = String(st ?? "").trim();
    if (!s) return true;
    return s !== "Done" && s !== "Removed";
  };

  const quality = {
    defects: {
      bySeverity: mkDist([
        ...defectWIs.map((w: any) => w.severity ?? null),
        ...defectChildren.map((c: any) => c.severity ?? null),
      ]),
      byPriority: mkDist([
        ...defectWIs.map((w: any) => w.priority ?? null),
        ...defectChildren.map((c: any) => c.priority ?? null),
      ]),
      byState: mkDist([
        ...defectWIs.map((w: any) => w.state ?? null),
        ...defectChildren.map((c: any) => c.state ?? null),
      ]),
      openCount:
        defectWIs.filter((w: any) => isOpen(w.state)).length +
        defectChildren.filter((c: any) => isOpen(c.state)).length,
    },
    bugs: {
      bySeverity: mkDist(bugChildren.map((c: any) => c.severity ?? null)),
      byPriority: mkDist(bugChildren.map((c: any) => c.priority ?? null)),
      byState: mkDist(bugChildren.map((c: any) => c.state ?? null)),
      openCount: bugChildren.filter((c: any) => isOpen(c.state)).length,
    },
  };

  // Per-sprint aggregates (planned vs realized based on snapshot at sprint start/end)
  const allWIsForMetrics = workItemsRepo.byTeam(teamId);

  const allRevs = revisionsRepo.byTeam(teamId);
  const revsByWi = new Map<number, typeof allRevs>();
  for (const r of allRevs) {
    const arr = revsByWi.get(r.work_item_id) ?? [];
    arr.push(r);
    revsByWi.set(r.work_item_id, arr);
  }

  const wiById = new Map(allWIsForMetrics.map((w) => [w.id, w] as const));

  const snapshotAt = (
    wiId: number,
    atIso: string
  ): { state: string | null; iterationPath: string | null; effort: number | null } => {
    const revs = revsByWi.get(wiId) ?? [];
    const atT = new Date(atIso).getTime();
    let last: any = null;
    for (let i = 0; i < revs.length; i++) {
      const t = new Date(revs[i].changed_date).getTime();
      if (t <= atT) last = revs[i];
      else break;
    }

    if (last) {
      return {
        state: (last.state ?? null) as string | null,
        iterationPath: (last.iteration_path ?? null) as string | null,
        effort: (last.effort ?? null) as number | null,
      };
    }

    const wi = wiById.get(wiId);
    return {
      state: (wi?.state ?? null) as string | null,
      iterationPath: (wi?.iteration_path ?? null) as string | null,
      effort: (wi?.effort ?? null) as number | null,
    };
  };

  const isInSprint = (iterationPath: string | null, sprint: Iteration): boolean => {
    if (!iterationPath) return false;
    if (sprint.path && iterationPath === sprint.path) return true;
    return iterationPath.endsWith(`\\${sprint.name}`) || iterationPath === sprint.name;
  };

  const isClosedWithinSprint = (closedDateIso: string | null, sprint: Iteration): boolean => {
    if (!closedDateIso || !sprint.start_date || !sprint.finish_date) return false;
    const t = new Date(closedDateIso).getTime();
    const startT = new Date(sprint.start_date).getTime();
    const endT = new Date(sprint.finish_date).getTime();
    return t >= startT && t <= endT;
  };

  const enteredSprintAfterStart = (wiId: number, sprint: Iteration): boolean => {
    if (!sprint.start_date || !sprint.finish_date) return false;
    const revs = revsByWi.get(wiId) ?? [];
    if (!revs.length) return false;

    const startT = new Date(sprint.start_date).getTime();
    const endT = new Date(sprint.finish_date).getTime();

    for (const r of revs) {
      const t = new Date(r.changed_date).getTime();
      if (t <= startT) continue;
      if (t > endT) break;
      if (isInSprint(r.iteration_path ?? null, sprint)) return true;
    }
    return false;
  };

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const min = (arr: number[]) => (arr.length ? Math.min(...arr) : null);
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : null);

  const sprintMetrics = sprints.map((s) => {
    const start = s.start_date;
    const end = s.finish_date;
    if (!start || !end) {
      return {
        sprintId: s.id,
        sprintName: s.name,
        startDate: s.start_date,
        finishDate: s.finish_date,
        planned: 0,
        completed: 0,
        extraAdded: 0,
        plannedEffort: 0,
        completedEffort: 0,
        extraEffort: 0,
        carryOver: 0,
        throughput: 0,
        completionRate: 0,
        avgLeadTime: null,
        avgCycleTime: null,
        leadTimeMin: null,
        leadTimeMax: null,
        cycleTimeMin: null,
        cycleTimeMax: null,
      };
    }

    const plannedIds: number[] = [];
    const completedIds: number[] = [];
    const extraAddedIds: number[] = [];

    let plannedEffort = 0;
    let completedEffort = 0;
    let extraEffort = 0;

    for (const wi of allWIsForMetrics) {
      const snapStart = snapshotAt(wi.id, start);
      const inStart = isInSprint(snapStart.iterationPath, s);
      const realized = isClosedWithinSprint(wi.closed_date ?? null, s);
      const enteredAfterStart = !inStart && enteredSprintAfterStart(wi.id, s);

      const effortAtStart = snapStart.effort ?? 0;
      const effortAtClose = realized && wi.closed_date ? (snapshotAt(wi.id, wi.closed_date).effort ?? 0) : 0;
      const effortAtEnd = snapshotAt(wi.id, end).effort ?? 0;

      if (inStart) {
        plannedIds.push(wi.id);
        plannedEffort += effortAtStart;
      }

      // If an item entered the sprint after it started, it is still part of the sprint scope.
      // It might not be completed within the sprint, but it should count towards planned/carryover.
      if (enteredAfterStart) {
        plannedIds.push(wi.id);
        plannedEffort += effortAtEnd;
      }

      if (realized) {
        if (inStart) {
          completedIds.push(wi.id);
          completedEffort += effortAtClose;
        } else if (enteredAfterStart) {
          extraAddedIds.push(wi.id);
          extraEffort += effortAtClose;
        }
      }
    }

    const realizedIds = [...completedIds, ...extraAddedIds];

    const leads = realizedIds
      .map((id) => metricsMap.get(id)?.lead_time)
      .filter((v): v is number => v != null);
    const cycles = realizedIds
      .map((id) => metricsMap.get(id)?.cycle_time)
      .filter((v): v is number => v != null);

    const planned = plannedIds.length;
    const completed = completedIds.length;
    const extraAdded = extraAddedIds.length;
    const throughput = completed + extraAdded;
    const carryOver = Math.max(0, planned - completed);
    const completionRate = planned ? Math.round((completed / planned) * 100) : 0;

    return {
      sprintId: s.id,
      sprintName: s.name,
      startDate: s.start_date,
      finishDate: s.finish_date,
      planned,
      completed,
      extraAdded,
      plannedEffort,
      completedEffort,
      extraEffort,
      carryOver,
      throughput,
      completionRate,
      avgLeadTime: avg(leads),
      avgCycleTime: avg(cycles),
      leadTimeMin: min(leads),
      leadTimeMax: max(leads),
      cycleTimeMin: min(cycles),
      cycleTimeMax: max(cycles),
    };
  });

  const realizedIdSet = new Set<number>();
  for (const sprint of sprints) {
    if (!sprint.start_date || !sprint.finish_date) continue;
    for (const wi of allWIsForMetrics) {
      if (isClosedWithinSprint(wi.closed_date ?? null, sprint)) realizedIdSet.add(wi.id);
    }
  }

  const leadTimeValues = Array.from(realizedIdSet)
    .map((id) => metricsMap.get(id)?.lead_time ?? null)
    .filter((v): v is number => v != null);

  const cycleTimeValues = Array.from(realizedIdSet)
    .map((id) => metricsMap.get(id)?.cycle_time ?? null)
    .filter((v): v is number => v != null);

  const leadByWeek = new Map<string, number[]>();
  for (const sprint of sprints) {
    if (!sprint.start_date || !sprint.finish_date) continue;
    for (const wi of allWIsForMetrics) {
      if (!isClosedWithinSprint(wi.closed_date ?? null, sprint)) continue;
      if (!wi.closed_date) continue;
      const lt = metricsMap.get(wi.id)?.lead_time ?? null;
      if (lt == null) continue;
      const wk = weekStartIso(wi.closed_date);
      const arr = leadByWeek.get(wk) ?? [];
      arr.push(lt);
      leadByWeek.set(wk, arr);
    }
  }

  const leadTimeByDeliveryWeek = Array.from(leadByWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, values]) => ({
      week,
      count: values.length,
      avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      p50: pct(values, 50),
      p85: pct(values, 85),
      p95: pct(values, 95),
    }));

  const cycleByWeek = new Map<string, number[]>();
  for (const sprint of sprints) {
    if (!sprint.start_date || !sprint.finish_date) continue;
    for (const wi of allWIsForMetrics) {
      if (!isClosedWithinSprint(wi.closed_date ?? null, sprint)) continue;
      if (!wi.closed_date) continue;
      const ct = metricsMap.get(wi.id)?.cycle_time ?? null;
      if (ct == null) continue;
      const wk = weekStartIso(wi.closed_date);
      const arr = cycleByWeek.get(wk) ?? [];
      arr.push(ct);
      cycleByWeek.set(wk, arr);
    }
  }

  const cycleTimeByDeliveryWeek = Array.from(cycleByWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, values]) => ({
      week,
      count: values.length,
      avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      p50: pct(values, 50),
      p85: pct(values, 85),
      p95: pct(values, 95),
    }));

  // Capacity — current sprint
  const currentSprint = sprints.find((s) => s.time_frame === "current") ?? sprints[sprints.length - 1];
  let memberCapacities: ReturnType<typeof calcCapacityWithDayOffs> = [];
  if (currentSprint) {
    const capRows = capacityRepo.byIteration(teamId, currentSprint.id);
    memberCapacities = calcCapacityWithDayOffs(
      capRows.map((c) => ({
        memberId:   c.member_id,
        memberName: c.member_name,
        activities: JSON.parse(c.activities || "[]"),
        daysOff:    JSON.parse(c.days_off    || "[]"),
        totalCapacity: c.total_capacity,
        realCapacity:  c.real_capacity,
        workingDays: 0,
        dayOffCount: 0,
      })),
      currentSprint.start_date,
      currentSprint.finish_date
    );
  }

  const allTasks = tasksRepo.byTeam(teamId);
  const nonFutureForCapacity = allSprints
    .filter((s) => s.time_frame !== "future")
    .filter((s) => Boolean(s.name))
    .slice(-4);

  const deliveredHoursBySprintAndPerson = new Map<string, number>();
  for (const sp of nonFutureForCapacity) {
    const tasksInSprint = allTasks.filter((t: any) => {
      if ((t.iteration_name ?? "") !== sp.name) return false;
      const st = String(t.state ?? "").trim();
      if (!st) return false;
      return st === "Done" || st === "Closed" || st === "Resolved";
    });

    for (const t of tasksInSprint) {
      const person = (t.assigned_to ?? "—") as string;
      const key = `${sp.id}::${person}`;

      const deliveredHrs =
        (t.completed_work ?? 0) > 0
          ? (t.completed_work ?? 0)
          : (t.original_estimate ?? 0) > 0
            ? (t.original_estimate ?? 0)
            : (t.remaining_work ?? 0);
      deliveredHoursBySprintAndPerson.set(
        key,
        (deliveredHoursBySprintAndPerson.get(key) ?? 0) + deliveredHrs
      );
    }
  }

  const capacityBySprintAndPerson = new Map<string, number>();
  for (const sp of nonFutureForCapacity) {
    const capRows = capacityRepo.byIteration(teamId, sp.id);
    const caps = calcCapacityWithDayOffs(
      capRows.map((c) => ({
        memberId:   c.member_id,
        memberName: c.member_name,
        activities: JSON.parse(c.activities || "[]"),
        daysOff:    JSON.parse(c.days_off    || "[]"),
        totalCapacity: c.total_capacity,
        realCapacity:  c.real_capacity,
        workingDays: 0,
        dayOffCount: 0,
      })),
      sp.start_date,
      sp.finish_date
    );
    for (const c of caps) {
      const fallback = capRows.find((r) => r.member_name === c.memberName)?.real_capacity ?? 0;
      capacityBySprintAndPerson.set(`${sp.id}::${c.memberName}`, (c.realCapacity ?? 0) || fallback);
    }
  }

  const memberNames = new Set<string>();
  for (const m of memberCapacities) memberNames.add(m.memberName);
  for (const k of Array.from(capacityBySprintAndPerson.keys())) memberNames.add(k.split("::")[1] ?? "—");
  for (const k of Array.from(deliveredHoursBySprintAndPerson.keys())) memberNames.add(k.split("::")[1] ?? "—");

  const capSummary = Array.from(memberNames)
    .filter((n) => n && n !== "—")
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const curCap = currentSprint ? (capacityBySprintAndPerson.get(`${currentSprint.id}::${name}`) ?? 0) : 0;
      const curDelivered = currentSprint ? (deliveredHoursBySprintAndPerson.get(`${currentSprint.id}::${name}`) ?? 0) : 0;

      const deliveredArr: number[] = [];
      const devArr: number[] = [];
      for (const sp of nonFutureForCapacity) {
        const delivered = deliveredHoursBySprintAndPerson.get(`${sp.id}::${name}`) ?? 0;
        const cap = capacityBySprintAndPerson.get(`${sp.id}::${name}`) ?? 0;
        deliveredArr.push(delivered);
        if (cap > 0) devArr.push(((delivered - cap) / cap) * 100);
      }

      const avgDelivered = deliveredArr.length
        ? deliveredArr.reduce((s, v) => s + v, 0) / deliveredArr.length
        : 0;
      const avgDeviationPct = devArr.length
        ? devArr.reduce((s, v) => s + v, 0) / devArr.length
        : 0;

      return {
        name,
        sprintCapacityHours: curCap,
        deliveredHours: curDelivered,
        avgDeliveredLast4Sprints: avgDelivered,
        avgPlanningDeviationPct: avgDeviationPct,
      };
    });

  // Individual capacity from tasks
  const tasks = currentSprint?.name
    ? allTasks.filter((t) => (t.iteration_name ?? "") === currentSprint.name)
    : allTasks;
  const openTasks = tasks.filter((t) => {
    const st = (t.state ?? "").trim();
    if (!st) return true;
    return st !== "Done" && st !== "Removed";
  });
  const individualCapacity = calcIndividualCapacity(openTasks);

  return NextResponse.json({
    team: { id: team.id, name: team.name, org: team.org, project: team.project, teamName: team.team_name },
    availableSprints,
    sprints,
    workItems: workItemDtos,
    sprintMetrics,
    leadTimeValues,
    cycleTimeValues,
    leadTimeByDeliveryWeek,
    cycleTimeByDeliveryWeek,
    currentSprint: currentSprint ?? null,
    memberCapacities,
    capacitySummary: capSummary,
    individualCapacity,
    quality,
  });
}
