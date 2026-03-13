/**
 * lib/analytics/engine.ts
 * Pure analytics functions — no DB access, no API calls.
 * Input: raw revisions / work items. Output: metrics objects.
 */
import { differenceInCalendarDays, parseISO, startOfWeek, format } from "date-fns";
import type { Revision, StatusEntry, WorkItem, Iteration, MemberCapacity, IndividualCapacity, Task } from "../types";

// ─── Workflow state groupings ─────────────────────────────────────

export const WORKFLOW_PHASES: Record<string, string[]> = {
  backlog:        ["New", "Approved", "Design", "To Do"],
  desenvolvimento: ["Committed", "In Progress"],
  qualidade:      ["Testing"],
  validacao:      ["Wait Client"],
  pronto:         ["Ready"],
  concluido:      ["Done"],
  cancelado:      ["Removed"],
};

export const ALL_STATES = Object.values(WORKFLOW_PHASES).flat();

// ─── processRevisions ────────────────────────────────────────────
/**
 * Given sorted raw revisions from the DB, build the status timeline
 * and compute Lead Time + Cycle Time.
 * Handles back-and-forth transitions correctly by accumulating time.
 */
export function processRevisions(revisions: Revision[]): {
  timeline: StatusEntry[];
  timeByStatus: Record<string, number>;
  leadTime: number | null;
  cycleTime: number | null;
  committedDate: string | null;
  inProgressDate: string | null;
  doneDate: string | null;
} {
  // Filter out revisions without a state change and sort chronologically
  const sorted = revisions
    .filter((r) => r.state && r.changed_date)
    .sort((a, b) => new Date(a.changed_date).getTime() - new Date(b.changed_date).getTime());

  if (!sorted.length) {
    return { timeline: [], timeByStatus: {}, leadTime: null, cycleTime: null, committedDate: null, inProgressDate: null, doneDate: null };
  }

  const timeline: StatusEntry[] = [];
  const timeByStatus: Record<string, number> = {};

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    // Skip if state did not change
    if (i > 0 && curr.state === sorted[i - 1].state) continue;

    // Find the next revision where the state differs (handles same-state re-entries)
    const nextDiff = sorted.slice(i + 1).find((r) => r.state !== curr.state);
    const endDate = nextDiff
      ? nextDiff.changed_date
      : curr.state === "Done" || curr.state === "Removed"
        ? curr.changed_date
        : new Date().toISOString();

    const duration = Math.max(
      0,
      (new Date(endDate).getTime() - new Date(curr.changed_date).getTime()) / 86_400_000
    );

    if (curr.state) {
      timeline.push({ state: curr.state, startDate: curr.changed_date, endDate, duration });
      timeByStatus[curr.state] = (timeByStatus[curr.state] ?? 0) + duration;
    }
  }

  // Key dates — first occurrence of each milestone state
  const firstDate = (state: string) =>
    sorted.find((r) => r.state === state)?.changed_date ?? null;

  const committedDate   = firstDate("Committed");
  const inProgressDate  = firstDate("In Progress");
  const doneDate        = firstDate("Done");

  const leadTime =
    committedDate && doneDate
      ? differenceInCalendarDays(parseISO(doneDate), parseISO(committedDate))
      : null;

  const cycleTime =
    inProgressDate && doneDate
      ? differenceInCalendarDays(parseISO(doneDate), parseISO(inProgressDate))
      : null;

  return { timeline, timeByStatus, leadTime, cycleTime, committedDate, inProgressDate, doneDate };
}

// ─── aggregateSprintMetrics ──────────────────────────────────────

export function aggregateSprintMetrics(
  workItems: WorkItem[],
  metricsMap: Map<number, { leadTime: number | null; cycleTime: number | null }>,
  sprint: Iteration
) {
  const inSprint = workItems.filter(
    (w) => w.iteration_name === sprint.name || w.iteration_path?.endsWith(`\\${sprint.name}`)
  );
  const completed = inSprint.filter((w) => w.state === "Done");

  const leads   = completed.map((w) => metricsMap.get(w.id)?.leadTime).filter((v): v is number => v != null);
  const cycles  = completed.map((w) => metricsMap.get(w.id)?.cycleTime).filter((v): v is number => v != null);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return {
    sprintId:       sprint.id,
    sprintName:     sprint.name,
    startDate:      sprint.start_date,
    finishDate:     sprint.finish_date,
    planned:        inSprint.length,
    completed:      completed.length,
    carryOver:      inSprint.length - completed.length,
    throughput:     completed.length,
    completionRate: inSprint.length ? Math.round((completed.length / inSprint.length) * 100) : 0,
    avgLeadTime:    avg(leads),
    avgCycleTime:   avg(cycles),
  };
}

// ─── calcWorkingDays ────────────────────────────────────────────

export function calcWorkingDays(start: string | Date, end: string | Date): number {
  let count = 0;
  const cur = new Date(start);
  const fin = new Date(end);
  while (cur <= fin) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── calcCapacityWithDayOffs ────────────────────────────────────

export function calcCapacityWithDayOffs(
  members: MemberCapacity[],
  sprintStart?: string | null,
  sprintEnd?: string | null
): MemberCapacity[] {
  if (!sprintStart || !sprintEnd) return members;

  return members.map((m) => {
    const workingDays = calcWorkingDays(sprintStart, sprintEnd);
    const dayOffCount = (m.daysOff ?? []).reduce(
      (sum, r) => sum + calcWorkingDays(r.start, r.end),
      0
    );
    const availableDays = Math.max(0, workingDays - dayOffCount);
    const totalCapacity = (m.activities ?? []).reduce(
      (s, a) => s + a.capacityPerDay * workingDays,
      0
    );
    const realCapacity = (m.activities ?? []).reduce(
      (s, a) => s + a.capacityPerDay * availableDays,
      0
    );
    return { ...m, workingDays, dayOffCount, totalCapacity, realCapacity, availableDays: availableDays as never };
  });
}

// ─── calcIndividualCapacity ─────────────────────────────────────

export function calcIndividualCapacity(tasks: Task[]): IndividualCapacity[] {
  const byPersonWeek: Record<string, number> = {};

  for (const t of tasks) {
    const key = `${t.assigned_to ?? "?"}::${t.week_key ?? "?"}`;
    byPersonWeek[key] = (byPersonWeek[key] ?? 0) + (t.remaining_work ?? 0);
  }

  const byPerson: Record<string, { weeks: Record<string, number>; total: number; count: number }> = {};
  for (const [key, hrs] of Object.entries(byPersonWeek)) {
    const [person, week] = key.split("::");
    if (!byPerson[person]) byPerson[person] = { weeks: {}, total: 0, count: 0 };
    byPerson[person].weeks[week] = hrs;
    byPerson[person].total += hrs;
    byPerson[person].count++;
  }

  const currentWeekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  return Object.entries(byPerson).map(([name, d]) => {
    const avgWeekly = d.count ? d.total / d.count : 0;
    const currentWeek = d.weeks[currentWeekKey] ?? 0;
    const variance = avgWeekly > 0 ? ((currentWeek - avgWeekly) / avgWeekly) * 100 : 0;
    return { name, currentWeek, avgWeekly, variance, weeklyHistory: d.weeks };
  });
}

// ─── weekKey ─────────────────────────────────────────────────────

export function weekKey(date: string | Date): string {
  return format(startOfWeek(new Date(date), { weekStartsOn: 1 }), "yyyy-MM-dd");
}
