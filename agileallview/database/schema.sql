-- ═══════════════════════════════════════════════════════════════════
-- AgileAllView — SQLite Schema
-- ═══════════════════════════════════════════════════════════════════
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Teams ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,          -- e.g. "team_1721000000000"
  name        TEXT NOT NULL,
  org         TEXT NOT NULL,             -- Azure DevOps organisation slug
  project     TEXT NOT NULL,
  team_name   TEXT NOT NULL,             -- exact name on Azure DevOps
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ── Iterations (Sprints) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iterations (
  id           TEXT PRIMARY KEY,         -- Azure iteration GUID
  team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  path         TEXT,
  start_date   TEXT,
  finish_date  TEXT,
  time_frame   TEXT DEFAULT 'past',      -- 'past' | 'current' | 'future'
  fetched_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_iter_team ON iterations(team_id);

-- ── Work Items (PBIs) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_items (
  id              INTEGER PRIMARY KEY,   -- Azure Work Item ID
  team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title           TEXT,
  state           TEXT,
  board_column    TEXT,
  board_column_done INTEGER,
  work_item_type  TEXT DEFAULT 'Product Backlog Item',
  created_date    TEXT,
  changed_date    TEXT,
  closed_date     TEXT,
  assigned_to     TEXT,
  iteration_path  TEXT,
  iteration_name  TEXT,
  area_path       TEXT,
  effort          REAL,
  activity        TEXT,
  -- custom fields
  bloqueio        INTEGER DEFAULT 0,
  tipo_bloqueio   TEXT,
  motivo_bloqueio TEXT,
  produto         TEXT,
  tecnologia      TEXT,
  number_mti      TEXT,
  dor_checklist   TEXT,
  dod_checklist   TEXT,
  fetched_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wi_team    ON work_items(team_id);
CREATE INDEX IF NOT EXISTS idx_wi_state   ON work_items(state);
CREATE INDEX IF NOT EXISTS idx_wi_iter    ON work_items(iteration_name);
CREATE INDEX IF NOT EXISTS idx_wi_changed ON work_items(changed_date);

-- ── Work Item Children (PBI -> Task/Bug) ─────────────────────────
CREATE TABLE IF NOT EXISTS work_item_children (
  parent_id      INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  child_id       INTEGER NOT NULL,
  child_type     TEXT,
  title          TEXT,
  assigned_to    TEXT,
  state          TEXT,
  remaining_work REAL,
  fetched_at     TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (parent_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_wic_parent ON work_item_children(parent_id);

-- ── Revisions (raw state history) ────────────────────────────────
CREATE TABLE IF NOT EXISTS revisions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  work_item_id  INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  rev           INTEGER NOT NULL,
  state         TEXT,
  assigned_to   TEXT,
  iteration_path TEXT,
  changed_date  TEXT NOT NULL,
  effort        REAL,
  activity      TEXT,
  UNIQUE(work_item_id, rev)
);
CREATE INDEX IF NOT EXISTS idx_rev_wi      ON revisions(work_item_id);
CREATE INDEX IF NOT EXISTS idx_rev_changed ON revisions(changed_date);

-- ── Computed Metrics (per work item) ─────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
  work_item_id    INTEGER PRIMARY KEY REFERENCES work_items(id) ON DELETE CASCADE,
  team_id         TEXT NOT NULL,
  lead_time       REAL,   -- days: Committed → Done
  cycle_time      REAL,   -- days: In Progress → Done
  committed_date  TEXT,
  in_progress_date TEXT,
  done_date       TEXT,
  time_by_status  TEXT,   -- JSON: { "In Progress": 3.5, ... }
  status_timeline TEXT,   -- JSON: [{ state, startDate, endDate, duration }]
  computed_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_metrics_team ON metrics(team_id);

-- ── Capacity (per member per sprint) ─────────────────────────────
CREATE TABLE IF NOT EXISTS capacity (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  iteration_id    TEXT NOT NULL,
  member_id       TEXT NOT NULL,
  member_name     TEXT NOT NULL,
  activities      TEXT,   -- JSON: [{ name, capacityPerDay }]
  days_off        TEXT,   -- JSON: [{ start, end }]
  total_capacity  REAL DEFAULT 0,
  real_capacity   REAL DEFAULT 0,
  UNIQUE(team_id, iteration_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_cap_team ON capacity(team_id, iteration_id);

-- ── Team Members ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id          TEXT,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  unique_name  TEXT,
  fetched_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (team_id, id)
);

-- ── Tasks (for individual capacity) ──────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY,
  team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assigned_to     TEXT,
  state           TEXT,
  remaining_work  REAL DEFAULT 0,
  completed_work  REAL DEFAULT 0,
  original_estimate REAL DEFAULT 0,
  changed_date    TEXT,
  iteration_name  TEXT,
  week_key        TEXT   -- ISO Monday date e.g. "2024-01-15"
);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_week ON tasks(week_key);

-- ── Sync State ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_state (
  team_id     TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  last_sync   TEXT,
  item_count  INTEGER DEFAULT 0,
  status      TEXT DEFAULT 'idle',   -- 'idle' | 'running' | 'error'
  error_msg   TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);
