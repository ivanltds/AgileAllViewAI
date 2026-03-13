"use client";
import { cn } from "./cn";

const PLANNING_STATES = new Set(["New", "To Do", "Design", "Planned", "Planning"]);
const APPROVED_STATES = new Set(["Approved"]);
const INPROGRESS_STATES = new Set(["In Progress", "Active", "Doing", "Committed"]);
const TESTING_STATES = new Set(["Testing", "Test", "QA", "Ready"]);
const DONE_STATES = new Set(["Done", "Closed", "Resolved"]);
const REMOVED_STATES = new Set(["Removed"]);

const stateColor = (state?: string): string => {
  const s = String(state ?? "").trim();
  if (APPROVED_STATES.has(s)) return "#e5e7eb";
  if (INPROGRESS_STATES.has(s)) return "#3b82f6";
  if (TESTING_STATES.has(s)) return "#f97316";
  if (DONE_STATES.has(s)) return "#22c55e";
  if (REMOVED_STATES.has(s)) return "#ef4444";
  if (PLANNING_STATES.has(s)) return "#6b7280";
  return "#6b7280";
};

export function StateBadge({ state }: { state?: string }) {
  const s = String(state ?? "").trim();
  const c = stateColor(s);
  const approved = APPROVED_STATES.has(s);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold",
        approved ? "border border-[rgba(255,255,255,.22)]" : ""
      )}
      style={{ background: approved ? "rgba(255,255,255,.08)" : c + "20", color: approved ? "var(--text)" : c }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: approved ? "#e5e7eb" : c }} />
      {s || "—"}
    </span>
  );
}

export function Badge({ children, variant = "default", className }: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warn" | "danger" | "purple";
  className?: string;
}) {
  const variantClass = {
    default: "bg-[var(--bg3)] text-[var(--text2)] border border-[var(--border)]",
    success: "bg-[rgba(34,197,94,.1)] text-[var(--success)] border border-[rgba(34,197,94,.3)]",
    warn:    "bg-[rgba(245,158,11,.1)] text-[var(--warn)] border border-[rgba(245,158,11,.3)]",
    danger:  "bg-[rgba(239,68,68,.1)] text-[var(--danger)] border border-[rgba(239,68,68,.3)]",
    purple:  "bg-[rgba(139,92,246,.1)] text-[var(--purple)] border border-[rgba(139,92,246,.3)]",
  }[variant];

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", variantClass, className)}>
      {children}
    </span>
  );
}
