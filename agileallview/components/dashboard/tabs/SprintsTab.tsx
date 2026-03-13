"use client";

import { Fragment, useMemo, useState } from "react";

// ── SprintsTab ────────────────────────────────────────────────────────────────
export function SprintsTab({ data }: { data: Record<string,unknown>|null }) {
  type SM = { sprintId:string; sprintName:string; startDate?:string|null; finishDate?:string|null; planned:number; completed:number; extraAdded?:number; carryOver:number; completionRate:number; avgLeadTime?:number|null };
  const sprints = (data?.sprintMetrics as SM[]) ?? [];
  type WI = { id:number; title?:string; iteration?:string; closedDate?:string|null; state?:string };
  const wis = (data?.workItems as WI[]) ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [futureOpen, setFutureOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

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

  const { current, future, past } = useMemo(() => {
    const now = Date.now();
    const parseT = (d?: string | null) => {
      if (!d) return null;
      const t = new Date(d).getTime();
      return Number.isFinite(t) ? t : null;
    };
    const startT = (s: SM) => parseT(s.startDate);
    const endT = (s: SM) => parseT(s.finishDate);

    const isCurrent = (s: SM) => {
      const st = startT(s);
      const et = endT(s);
      if (st != null && et != null) return st <= now && now <= et;
      return false;
    };
    const isFuture = (s: SM) => {
      const st = startT(s);
      if (st != null) return st > now;
      const et = endT(s);
      return et != null ? et > now : false;
    };
    const isPast = (s: SM) => {
      const et = endT(s);
      if (et != null) return et < now;
      const st = startT(s);
      return st != null ? st < now : true;
    };

    const cur = sprints.filter(isCurrent);
    const fut = sprints.filter((s) => !isCurrent(s) && isFuture(s));
    const pst = sprints.filter((s) => !isCurrent(s) && isPast(s) && !isFuture(s));

    const sortDesc = (a: SM, b: SM) => {
      const at = endT(a) ?? startT(a) ?? 0;
      const bt = endT(b) ?? startT(b) ?? 0;
      return bt - at;
    };

    cur.sort(sortDesc);
    fut.sort(sortDesc);
    pst.sort(sortDesc);

    return { current: cur, future: fut, past: pst };
  }, [sprints]);

  const renderSprint = (s: SM) => {
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
  };

  if (!sprints.length) return (
    <div className="py-16 text-center text-[var(--text3)]">Nenhuma sprint encontrada. Sincronize o time.</div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4">
        <div className="text-sm font-semibold">Sprint atual</div>
      </div>
      {current.length ? current.map(renderSprint) : (
        <div className="py-6 text-center text-[var(--text3)]">Nenhuma sprint atual encontrada.</div>
      )}

      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4 flex items-center justify-between">
        <div className="text-sm font-semibold">Futuras <span className="text-[var(--text3)] font-normal font-mono">({future.length})</span></div>
        <button
          onClick={() => setFutureOpen((v) => !v)}
          className="text-xs px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
        >
          {futureOpen ? "Recolher" : "Expandir"}
        </button>
      </div>
      {futureOpen && future.map(renderSprint)}

      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4 flex items-center justify-between">
        <div className="text-sm font-semibold">Passadas <span className="text-[var(--text3)] font-normal font-mono">({past.length})</span></div>
        <button
          onClick={() => setPastOpen((v) => !v)}
          className="text-xs px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
        >
          {pastOpen ? "Recolher" : "Expandir"}
        </button>
      </div>
      {pastOpen && past.map(renderSprint)}
    </div>
  );
}
