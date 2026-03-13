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
  teamsRepo, iterationsRepo, workItemsRepo,
  metricsRepo, capacityRepo, tasksRepo,
} from "@/lib/storage/repositories";
import {
  aggregateSprintMetrics,
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

  // Per-sprint aggregates
  const allSprintsForMetrics = iterationsRepo.byTeam(teamId);
  const allWIsForMetrics     = workItemsRepo.byTeam(teamId);
  const ltCycleMap = new Map(
    allMetrics.map((m) => [
      m.work_item_id,
      {
        leadTime:  m.lead_time ?? null,
        cycleTime: m.cycle_time ?? null,
      },
    ])
  );

  const sprintMetrics = sprints.map((s) =>
    aggregateSprintMetrics(allWIsForMetrics, ltCycleMap, s)
  );

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
