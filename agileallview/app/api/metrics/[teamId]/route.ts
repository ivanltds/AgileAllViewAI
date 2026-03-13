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
  metricsRepo, capacityRepo, tasksRepo,
} from "@/lib/storage/repositories";
import {
  calcIndividualCapacity,
  calcCapacityWithDayOffs,
} from "@/lib/analytics/engine";
import type { Iteration } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: { teamId: string } }) {
  const { teamId } = params;
  const url = new URL(req.url);
  const sprintsFilter  = parseInt(url.searchParams.get("sprints") ?? "4");
  const sprintIdsParam = url.searchParams.get("sprintIds");
  const dateFrom       = url.searchParams.get("from");
  const dateTo         = url.searchParams.get("to");

  const team = teamsRepo.byId(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // All sprints for this team
  const allSprints = iterationsRepo.byTeam(teamId);
  const availableSprints = allSprints
    .filter((s) => s.time_frame !== "future")
    .slice(-4);

  let sprints = allSprints;

  // Apply filter
  if (sprintIdsParam) {
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

  // Work items for filtered sprints
  const allWIs = workItemsRepo.byTeam(teamId).filter(
    (w) => !sprints.length || (w.iteration_name && sprintNames.has(w.iteration_name))
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
      iteration:  wi.iteration_name,
      assignedTo: wi.assigned_to,
      effort:     wi.effort,
      activity:   wi.activity,
      bloqueio:   Boolean(wi.bloqueio),
      leadTime:   m?.lead_time ?? null,
      cycleTime:  m?.cycle_time ?? null,
      statusTimeline: m ? JSON.parse(m.status_timeline || "[]") : [],
      timeByStatus:   m ? JSON.parse(m.time_by_status  || "{}") : {},
    };
  });

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

      if (inStart) {
        plannedIds.push(wi.id);
        plannedEffort += effortAtStart;
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

    const leads = completedIds
      .map((id) => metricsMap.get(id)?.lead_time)
      .filter((v): v is number => v != null);
    const cycles = completedIds
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
    };
  });

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

  // Individual capacity from tasks
  const tasks = tasksRepo.byTeam(teamId);
  const individualCapacity = calcIndividualCapacity(tasks);

  return NextResponse.json({
    team: { id: team.id, name: team.name, org: team.org, project: team.project, teamName: team.team_name },
    availableSprints,
    sprints,
    workItems: workItemDtos,
    sprintMetrics,
    currentSprint: currentSprint ?? null,
    memberCapacities,
    individualCapacity,
  });
}
