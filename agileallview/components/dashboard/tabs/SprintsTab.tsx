"use client";

// ── SprintsTab ────────────────────────────────────────────────────────────────
export function SprintsTab({ data }: { data: Record<string,unknown>|null }) {
  type SM = { sprintId:string; sprintName:string; startDate?:string|null; finishDate?:string|null; planned:number; completed:number; carryOver:number; completionRate:number; avgLeadTime?:number|null };
  const sprints = (data?.sprintMetrics as SM[]) ?? [];

  if (!sprints.length) return (
    <div className="py-16 text-center text-[var(--text3)]">Nenhuma sprint encontrada. Sincronize o time.</div>
  );

  return (
    <div className="space-y-4">
      {sprints.map((s) => {
        const pct = s.completionRate;
        const pctColor = pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
        const fmt = (d?: string|null) => d ? new Date(d).toLocaleDateString("pt-BR") : "?";
        return (
          <div key={s.sprintId} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-base font-bold font-display">{s.sprintName}</div>
                <div className="text-[11px] text-[var(--text3)] font-mono mt-1">{fmt(s.startDate)} → {fmt(s.finishDate)}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold font-mono" style={{ color: pctColor }}>{pct}%</div>
                <div className="text-[10px] text-[var(--text3)]">conclusão</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2.5 mb-4">
              {[
                ["Planejado",  s.planned,      "var(--accent)"],
                ["Realizado",  s.completed,    "var(--success)"],
                ["Carry Over", s.carryOver,    "var(--danger)"],
                ["Lead Time",  s.avgLeadTime != null ? `${s.avgLeadTime.toFixed(1)}d` : "—", "var(--purple)"],
              ].map(([lbl, val, c]) => (
                <div key={String(lbl)} className="bg-[var(--bg3)] rounded-lg px-3 py-2.5">
                  <div className="text-xl font-bold font-mono leading-none" style={{ color: String(c) }}>{String(val)}</div>
                  <div className="text-[9px] text-[var(--text3)] uppercase tracking-wide mt-1">{String(lbl)}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-[var(--bg4)]">
              <div style={{ flex: s.completed, background: "var(--success)" }} />
              <div style={{ flex: s.carryOver, background: "var(--danger)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
