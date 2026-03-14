/**
 * lib/storage/repositories.ts
 * Typed helpers for every table. All functions are synchronous
 * (better-sqlite3 is sync-first by design).
 */
import { getDb } from "./db";
import type { Team, Iteration, WorkItem, Revision, Metric, CapacityRow, Member, Task, SyncState } from "../types";

// ─── Teams ────────────────────────────────────────────────────────────────────

export const teamsRepo = {
  all(): Team[] {
    return getDb().prepare("SELECT * FROM teams ORDER BY name").all() as Team[];
  },
  byId(id: string): Team | undefined {
    return getDb().prepare("SELECT * FROM teams WHERE id = ?").get(id) as Team | undefined;
  },
  upsert(t: Team) {
    getDb().prepare(`
      INSERT INTO teams (id, name, org, project, team_name)
      VALUES (@id, @name, @org, @project, @team_name)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, org=excluded.org,
        project=excluded.project, team_name=excluded.team_name
    `).run(t);
  },
  delete(id: string) {
    getDb().prepare("DELETE FROM teams WHERE id = ?").run(id);
  },
};

// ─── Work Item Children (PBI -> Task/Bug) ────────────────────────────────────

export const workItemChildrenRepo = {
  byParents(parentIds: number[]): { parent_id: number; child_id: number; child_type: string | null; title: string | null; assigned_to: string | null; state: string | null; remaining_work: number | null }[] {
    if (!parentIds.length) return [];
    const placeholders = parentIds.map(() => "?").join(",");
    return getDb().prepare(
      `SELECT parent_id, child_id, child_type, title, assigned_to, state, remaining_work
       FROM work_item_children
       WHERE parent_id IN (${placeholders})
       ORDER BY parent_id ASC, child_id ASC`
    ).all(...parentIds) as any;
  },
  deleteByParents(parentIds: number[]) {
    if (!parentIds.length) return;
    const placeholders = parentIds.map(() => "?").join(",");
    getDb().prepare(
      `DELETE FROM work_item_children WHERE parent_id IN (${placeholders})`
    ).run(...parentIds);
  },
  upsertBulk(rows: { parent_id: number; child_id: number; child_type?: string | null; title?: string | null; assigned_to?: string | null; state?: string | null; remaining_work?: number | null }[]) {
    if (!rows.length) return;
    const stmt = getDb().prepare(`
      INSERT INTO work_item_children (parent_id, child_id, child_type, title, assigned_to, state, remaining_work)
      VALUES (@parent_id, @child_id, @child_type, @title, @assigned_to, @state, @remaining_work)
      ON CONFLICT(parent_id, child_id) DO UPDATE SET
        child_type=excluded.child_type,
        title=excluded.title,
        assigned_to=excluded.assigned_to,
        state=excluded.state,
        remaining_work=excluded.remaining_work,
        fetched_at=datetime('now')
    `);
    const insert = getDb().transaction((items: typeof rows) => {
      for (const r of items) stmt.run(r as any);
    });
    insert(rows as any);
  },
};

// ─── Iterations ───────────────────────────────────────────────────────────────

export const iterationsRepo = {
  byTeam(teamId: string): Iteration[] {
    return getDb().prepare(
      "SELECT * FROM iterations WHERE team_id = ? ORDER BY start_date ASC"
    ).all(teamId) as Iteration[];
  },
  upsertBulk(rows: Iteration[]) {
    const stmt = getDb().prepare(`
      INSERT INTO iterations (id, team_id, name, path, start_date, finish_date, time_frame)
      VALUES (@id, @team_id, @name, @path, @start_date, @finish_date, @time_frame)
      ON CONFLICT(id) DO UPDATE SET
        time_frame=excluded.time_frame,
        start_date=excluded.start_date,
        finish_date=excluded.finish_date
    `);
    const insert = getDb().transaction((items: Iteration[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Work Items ───────────────────────────────────────────────────────────────

export const workItemsRepo = {
  byTeam(teamId: string): WorkItem[] {
    return getDb().prepare("SELECT * FROM work_items WHERE team_id = ?").all(teamId) as WorkItem[];
  },
  byTeamAndSprints(teamId: string, sprintNames: string[]): WorkItem[] {
    if (!sprintNames.length) return workItemsRepo.byTeam(teamId);
    const placeholders = sprintNames.map(() => "?").join(",");
    return getDb().prepare(
      `SELECT * FROM work_items WHERE team_id = ? AND iteration_name IN (${placeholders})`
    ).all(teamId, ...sprintNames) as WorkItem[];
  },
  upsertBulk(rows: WorkItem[]) {
    const stmt = getDb().prepare(`
      INSERT INTO work_items (
        id, team_id, title, state, board_column, board_column_done, work_item_type, created_date, changed_date,
        closed_date, assigned_to, iteration_path, iteration_name, area_path,
        effort, activity, bloqueio, tipo_bloqueio, motivo_bloqueio, produto,
        tecnologia, number_mti, dor_checklist, dod_checklist
      ) VALUES (
        @id, @team_id, @title, @state, @board_column, @board_column_done, @work_item_type, @created_date, @changed_date,
        @closed_date, @assigned_to, @iteration_path, @iteration_name, @area_path,
        @effort, @activity, @bloqueio, @tipo_bloqueio, @motivo_bloqueio, @produto,
        @tecnologia, @number_mti, @dor_checklist, @dod_checklist
      ) ON CONFLICT(id) DO UPDATE SET
        state=excluded.state, changed_date=excluded.changed_date,
        assigned_to=excluded.assigned_to, iteration_path=excluded.iteration_path,
        iteration_name=excluded.iteration_name, effort=excluded.effort,
        closed_date=excluded.closed_date,
        board_column=excluded.board_column,
        board_column_done=excluded.board_column_done
    `);
    const insert = getDb().transaction((items: WorkItem[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Revisions ────────────────────────────────────────────────────────────────

export const revisionsRepo = {
  byWorkItem(workItemId: number): Revision[] {
    return getDb().prepare(
      "SELECT * FROM revisions WHERE work_item_id = ? ORDER BY changed_date ASC"
    ).all(workItemId) as Revision[];
  },
  byTeam(teamId: string): Revision[] {
    return getDb().prepare(
      `SELECT r.*
       FROM revisions r
       JOIN work_items w ON w.id = r.work_item_id
       WHERE w.team_id = ?
       ORDER BY r.work_item_id ASC, r.changed_date ASC`
    ).all(teamId) as Revision[];
  },
  maxRev(workItemId: number): number {
    const row = getDb().prepare(
      "SELECT MAX(rev) as max_rev FROM revisions WHERE work_item_id = ?"
    ).get(workItemId) as { max_rev: number | null };
    return row?.max_rev ?? 0;
  },
  upsertBulk(rows: Revision[]) {
    const stmt = getDb().prepare(`
      INSERT OR IGNORE INTO revisions
        (work_item_id, rev, state, assigned_to, iteration_path, changed_date, effort, activity)
      VALUES
        (@work_item_id, @rev, @state, @assigned_to, @iteration_path, @changed_date, @effort, @activity)
    `);
    const insert = getDb().transaction((items: Revision[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Metrics ─────────────────────────────────────────────────────────────────

export const metricsRepo = {
  byTeam(teamId: string): Metric[] {
    return getDb().prepare("SELECT * FROM metrics WHERE team_id = ?").all(teamId) as Metric[];
  },
  byWorkItem(workItemId: number): Metric | undefined {
    return getDb().prepare("SELECT * FROM metrics WHERE work_item_id = ?").get(workItemId) as Metric | undefined;
  },
  upsertBulk(rows: Metric[]) {
    const stmt = getDb().prepare(`
      INSERT INTO metrics (
        work_item_id, team_id, lead_time, cycle_time, committed_date,
        in_progress_date, done_date, time_by_status, status_timeline, computed_at
      ) VALUES (
        @work_item_id, @team_id, @lead_time, @cycle_time, @committed_date,
        @in_progress_date, @done_date, @time_by_status, @status_timeline, datetime('now')
      ) ON CONFLICT(work_item_id) DO UPDATE SET
        lead_time=excluded.lead_time, cycle_time=excluded.cycle_time,
        committed_date=excluded.committed_date, in_progress_date=excluded.in_progress_date,
        done_date=excluded.done_date, time_by_status=excluded.time_by_status,
        status_timeline=excluded.status_timeline, computed_at=datetime('now')
    `);
    const insert = getDb().transaction((items: Metric[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Capacity ────────────────────────────────────────────────────────────────

export const capacityRepo = {
  byIteration(teamId: string, iterationId: string): CapacityRow[] {
    return getDb().prepare(
      "SELECT * FROM capacity WHERE team_id = ? AND iteration_id = ?"
    ).all(teamId, iterationId) as CapacityRow[];
  },
  upsertBulk(rows: CapacityRow[]) {
    const stmt = getDb().prepare(`
      INSERT INTO capacity
        (team_id, iteration_id, member_id, member_name, activities, days_off, total_capacity, real_capacity)
      VALUES
        (@team_id, @iteration_id, @member_id, @member_name, @activities, @days_off, @total_capacity, @real_capacity)
      ON CONFLICT(team_id, iteration_id, member_id) DO UPDATE SET
        activities=excluded.activities, days_off=excluded.days_off,
        total_capacity=excluded.total_capacity, real_capacity=excluded.real_capacity
    `);
    const insert = getDb().transaction((items: CapacityRow[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Members ─────────────────────────────────────────────────────────────────

export const membersRepo = {
  byTeam(teamId: string): Member[] {
    return getDb().prepare("SELECT * FROM members WHERE team_id = ?").all(teamId) as Member[];
  },
  upsertBulk(rows: Member[]) {
    const stmt = getDb().prepare(`
      INSERT INTO members (id, team_id, display_name, unique_name)
      VALUES (@id, @team_id, @display_name, @unique_name)
      ON CONFLICT(team_id, id) DO UPDATE SET
        display_name=excluded.display_name, unique_name=excluded.unique_name
    `);
    const insert = getDb().transaction((items: Member[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasksRepo = {
  byTeam(teamId: string): Task[] {
    return getDb().prepare("SELECT * FROM tasks WHERE team_id = ?").all(teamId) as Task[];
  },
  upsertBulk(rows: Task[]) {
    const stmt = getDb().prepare(`
      INSERT INTO tasks (id, team_id, assigned_to, state, remaining_work, completed_work, original_estimate, changed_date, iteration_name, week_key)
      VALUES (@id, @team_id, @assigned_to, @state, @remaining_work, @completed_work, @original_estimate, @changed_date, @iteration_name, @week_key)
      ON CONFLICT(id) DO UPDATE SET
        assigned_to=excluded.assigned_to,
        state=excluded.state,
        remaining_work=excluded.remaining_work,
        completed_work=excluded.completed_work,
        original_estimate=excluded.original_estimate,
        changed_date=excluded.changed_date,
        iteration_name=excluded.iteration_name,
        week_key=excluded.week_key
    `);
    const insert = getDb().transaction((items: Task[]) => {
      for (const i of items) stmt.run(i);
    });
    insert(rows);
  },
};

// ─── Sync State ───────────────────────────────────────────────────────────────

export const syncStateRepo = {
  get(teamId: string): SyncState | undefined {
    return getDb().prepare("SELECT * FROM sync_state WHERE team_id = ?").get(teamId) as SyncState | undefined;
  },
  set(teamId: string, data: Partial<SyncState>) {
    getDb().prepare(`
      INSERT INTO sync_state (team_id, last_sync, item_count, status, error_msg, updated_at)
      VALUES (@team_id, @last_sync, @item_count, @status, @error_msg, datetime('now'))
      ON CONFLICT(team_id) DO UPDATE SET
        last_sync=excluded.last_sync, item_count=excluded.item_count,
        status=excluded.status, error_msg=excluded.error_msg, updated_at=datetime('now')
    `).run({ team_id: teamId, last_sync: null, item_count: 0, status: "idle", error_msg: null, ...data });
  },
};
