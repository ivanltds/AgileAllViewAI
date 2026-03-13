"use client";
import { cn } from "./cn";

const STATE_COLORS: Record<string, string> = {
  New: "#6b7280", Approved: "#8b5cf6", Design: "#a78bfa", "To Do": "#3b82f6",
  Committed: "#f59e0b", "In Progress": "#f97316", Testing: "#06b6d4",
  "Wait Client": "#ec4899", Ready: "#10b981", Done: "#22c55e", Removed: "#ef4444",
};

export function StateBadge({ state }: { state?: string }) {
  const c = state ? (STATE_COLORS[state] ?? "#6b7280") : "#6b7280";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c + "20", color: c }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
      {state ?? "—"}
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
