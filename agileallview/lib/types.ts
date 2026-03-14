// ═══════════════════════════════════════════════════════════════════
// lib/types.ts — shared domain types
// ═══════════════════════════════════════════════════════════════════

// ── DB row types (snake_case mirrors SQLite columns) ──────────────

export interface Team {
  id: string;
  name: string;
  org: string;
  project: string;
  team_name: string;
  created_at?: string;
}

export interface Iteration {
  id: string;
  team_id: string;
  name: string;
  path?: string;
  start_date?: string | null;
  finish_date?: string | null;
  time_frame?: string;
  fetched_at?: string;
}

export interface WorkItem {
  id: number;
  team_id: string;
  title?: string;
  state?: string;
  board_column?: string | null;
  board_column_done?: number | null;
  priority?: number | null;
  severity?: string | null;
  work_item_type?: string;
  created_date?: string;
  changed_date?: string;
  closed_date?: string | null;
  assigned_to?: string;
  iteration_path?: string;
  iteration_name?: string;
  area_path?: string;
  effort?: number | null;
  activity?: string;
  bloqueio?: number;
  tipo_bloqueio?: string | null;
  motivo_bloqueio?: string | null;
  produto?: string | null;
  tecnologia?: string | null;
  number_mti?: string | null;
  dor_checklist?: string | null;
  dod_checklist?: string | null;
  fetched_at?: string;
}

export interface Revision {
  id?: number;
  work_item_id: number;
  rev: number;
  state?: string | null;
  assigned_to?: string | null;
  iteration_path?: string | null;
  changed_date: string;
  effort?: number | null;
  activity?: string | null;
}

export interface StatusEntry {
  state: string;
  startDate: string;
  endDate: string;
  duration: number; // days
}

export interface Metric {
  work_item_id: number;
  team_id: string;
  lead_time?: number | null;
  cycle_time?: number | null;
  committed_date?: string | null;
  in_progress_date?: string | null;
  done_date?: string | null;
  time_by_status: string;   // JSON string
  status_timeline: string;  // JSON string
  computed_at?: string;
}

export interface CapacityRow {
  id?: number;
  team_id: string;
  iteration_id: string;
  member_id: string;
  member_name: string;
  activities: string;   // JSON string: [{ name, capacityPerDay }]
  days_off: string;     // JSON string: [{ start, end }]
  total_capacity: number;
  real_capacity: number;
}

export interface Member {
  id: string;
  team_id: string;
  display_name: string;
  unique_name?: string;
  fetched_at?: string;
}

export interface Task {
  id: number;
  team_id: string;
  assigned_to?: string;
  state?: string;
  remaining_work?: number;
  completed_work?: number;
  original_estimate?: number;
  changed_date?: string;
  iteration_name?: string;
  week_key?: string;
}

export interface SyncState {
  team_id: string;
  last_sync?: string | null;
  item_count?: number;
  status?: string;
  error_msg?: string | null;
  updated_at?: string;
}

// ── API response types (camelCase for the frontend) ───────────────

export interface TeamDto {
  id: string;
  name: string;
  org: string;
  project: string;
  teamName: string;
  syncState?: {
    lastSync: string | null;
    itemCount: number;
    status: string;
  };
  kpis?: {
    avgLeadTime: number | null;
    avgCycleTime: number | null;
    throughput: number;
    completionRate: number;
    totalPbis?: number;
    openBugs?: number;
    openDefects?: number;
  };
}

export interface SprintMetrics {
  sprintId: string;
  sprintName: string;
  startDate?: string | null;
  finishDate?: string | null;
  planned: number;
  completed: number;
  carryOver: number;
  throughput: number;
  completionRate: number;
  avgLeadTime: number | null;
  avgCycleTime: number | null;
}

export interface WorkItemDto {
  id: number;
  title?: string;
  state?: string;
  boardColumn?: string | null;
  boardColumnDone?: number | null;
  priority?: number | null;
  severity?: string | null;
  workItemType?: string | null;
  iteration?: string;
  assignedTo?: string;
  effort?: number | null;
  activity?: string | null;
  bloqueio?: boolean;
  leadTime?: number | null;
  cycleTime?: number | null;
  statusTimeline?: StatusEntry[];
  timeByStatus?: Record<string, number>;
}

export interface MemberCapacity {
  memberId: string;
  memberName: string;
  activities: { name: string; capacityPerDay: number }[];
  daysOff: { start: string; end: string }[];
  totalCapacity: number;
  realCapacity: number;
  workingDays: number;
  dayOffCount: number;
}

export interface IndividualCapacity {
  name: string;
  currentWeek: number;
  avgWeekly: number;
  variance: number; // percent
  weeklyHistory: Record<string, number>;
}

export interface SyncProgressEvent {
  step: string;
  msg: string;
  pct: number;
}

// ── Azure DevOps raw types ────────────────────────────────────────

export interface AzureWorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations?: { rel: string; url: string }[];
}

export interface AzureRevision {
  rev: number;
  fields: Record<string, unknown>;
}

export interface AzureIteration {
  id: string;
  name: string;
  path?: string;
  attributes?: {
    startDate?: string;
    finishDate?: string;
    timeFrame?: string;
  };
}

export interface AzureCapacityMember {
  teamMember?: { id: string; displayName: string };
  activities?: { name: string; capacityPerDay: number }[];
  daysOff?: { start: string; end: string }[];
}
