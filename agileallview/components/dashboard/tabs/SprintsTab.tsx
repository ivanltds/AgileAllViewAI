"use client";

import { Fragment, useMemo, useState } from "react";

// ── SprintsTab ────────────────────────────────────────────────────────────────
export function SprintsTab({ data }: { data: Record<string,unknown>|null }) {
  type SM = { sprintId:string; sprintName:string; startDate?:string|null; finishDate?:string|null; planned:number; completed:number; extraAdded?:number; carryOver:number; completionRate:number; avgLeadTime?:number|null };
  const sprints = (data?.sprintMetrics as SM[]) ?? [];
  type WI = { id:number; title?:string; iteration?:string; closedDate?:string|null; state?:string };
  const wis = (data?.workItems as WI[]) ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const team = (data as any)?.team as { org?: string; project?: string } | undefined;
  const azureUrl = (id: number) => {
    const org = team?.org ? encodeURIComponent(team.org) : "";
    const project = team?.project ? encodeURIComponent(team.project) : "";
    if (!org || !project) return `#${id}`;
    return `https://dev.azure.com/${org}/${project}/_workitems/edit/${id}`;
  };

  const itemsBySprint = useMemo(() => {
    const map: Record<string, WI[]> = {};
    for (const s of sprints) {
      const startT = s.startDate ? new Date(s.startDate).getTime() : null;
      const endT = s.finishDate ? new Date(s.finishDate).getTime() : null;
      const arr = wis.filter((w) => {
        const closedT = w.closedDate ? new Date(w.closedDate).getTime() : null;
        if (closedT != null && startT != null && endT != null) {
          return closedT >= startT && closedT <= endT;
        }
        return Boolean(w.iteration && w.iteration === s.sprintName);
      });
      map[s.sprintId] = arr;
    }
    return map;
  }, [sprints, wis]);

  if (!sprints.length) return (
    <div className="py-16 text-center text-[var(--text3)]">Nenhuma sprint encontrada. Sincronize o time.</div>
  );

  return (
    <div className="space-y-4">
      {sprints.map((s) => {
        const pct = s.completionRate;
        const pctColor = pct >= 80 ? "var(--success)" : pct >= 60 ? "var(--warn)" : "var(--danger)";
        const fmt = (d?: string|null) => d ? new Date(d).toLocaleDateString("pt-BR") : "?";
        const isExpanded = Boolean(expanded[s.sprintId]);
        const items = itemsBySprint[s.sprintId] ?? [];
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

            <div className="grid grid-cols-5 gap-2.5 mb-4">
              {[
                ["Planejado",  s.planned,      "var(--accent)"],
                ["Realizado",  s.completed,    "var(--success)"],
                ["Extra",      s.extraAdded ?? 0, "var(--warn)"],
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

            <div className="mt-4">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [s.sprintId]: !isExpanded }))}
                className="text-xs px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
              >
                {isExpanded ? "Recolher PBIs" : `Ver PBIs (${items.length})`}
              </button>
            </div>

            {isExpanded && (
              <div className="mt-3 border border-[var(--border)] rounded-lg overflow-hidden">
                {items.length === 0 ? (
                  <div className="px-4 py-3 text-[11px] text-[var(--text3)] bg-[var(--bg3)]">Nenhum PBI encontrado para esta sprint.</div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {items.map((w) => (
                      <Fragment key={w.id}>
                        <div className="px-4 py-2.5 bg-[var(--bg3)] text-[11px] flex items-center justify-between gap-4">
                          <a href={azureUrl(w.id)} target="_blank" rel="noreferrer" className="hover:underline text-[var(--text)]">
                            <span className="font-mono text-[var(--accent)]">{w.id}</span>
                            <span className="text-[var(--text3)]"> — </span>
                            <span>{w.title ?? "—"}</span>
                          </a>
                          <span className="text-[10px] text-[var(--text3)]">{w.state ?? ""}</span>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
