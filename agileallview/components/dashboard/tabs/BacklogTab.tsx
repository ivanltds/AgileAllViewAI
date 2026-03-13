"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { StateBadge } from "@/components/ui/Badge";
import { FlowBar } from "@/components/ui/FlowBar";

const STATE_COLORS: Record<string,string> = {
  // Planning
  New:"#6b7280",
  "To Do":"#6b7280",
  Design:"#6b7280",
  Planned:"#6b7280",
  Planning:"#6b7280",
  // Approved
  Approved:"#e5e7eb",
  // In progress
  Committed:"#3b82f6",
  "In Progress":"#3b82f6",
  Active:"#3b82f6",
  Doing:"#3b82f6",
  // Testing
  Testing:"#f97316",
  Test:"#f97316",
  QA:"#f97316",
  Ready:"#f97316",
  // Done
  Done:"#22c55e",
  Closed:"#22c55e",
  Resolved:"#22c55e",
  // Removed
  Removed:"#ef4444",
};

type WI = { id:number; title?:string; state?:string; boardColumn?:string|null; iteration?:string; assignedTo?:string; effort?:number|null; leadTime?:number|null; cycleTime?:number|null; statusTimeline?:{state:string;startDate:string;endDate:string;duration:number}[]; timeByStatus?:Record<string,number> };

type SortKey = "id" | "title" | "state" | "boardColumn" | "iteration" | "effort" | "leadTime" | "cycleTime" | "assignedTo" | "remainingSum";

type ChildRow = { id: number; type: string | null; title: string | null; state: string | null; assignedTo: string | null; remainingWork: number | null };

export function BacklogTab({ data, openBacklog }: { data: Record<string,unknown>|null; openBacklog?: boolean }) {
  const wis = (data?.workItems as WI[]) ?? [];
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>({ key: "id", dir: "desc" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [children, setChildren] = useState<Record<string, ChildRow[]>>({});
  const [remainingSums, setRemainingSums] = useState<Record<string, number>>({});

  const team = (data as any)?.team as { org?: string; project?: string } | undefined;
  const azureUrl = (id: number) => {
    const org = team?.org ? encodeURIComponent(team.org) : "";
    const project = team?.project ? encodeURIComponent(team.project) : "";
    if (!org || !project) return `#${id}`;
    return `https://dev.azure.com/${org}/${project}/_workitems/edit/${id}`;
  };

  const laneForChildState = (state?: string | null): "todo" | "inprogress" | "done" => {
    const s = String(state ?? "").trim();
    if (!s) return "todo";
    const doneStates = new Set(["Done", "Closed", "Resolved", "Removed"]);
    if (doneStates.has(s)) return "done";
    const inProgressStates = new Set(["In Progress", "Active", "Doing", "Committed", "Testing", "Ready"]);
    if (inProgressStates.has(s)) return "inprogress";
    return "todo";
  };

  const fetchChildrenBatch = async (ids: number[]) => {
    if (!ids.length) return;
    const tid = String((data as any)?.team?.id ?? "");
    if (!tid) return;

    const res = await fetch(`/api/workitems/${tid}/children?parentIds=${ids.join(",")}`);
    if (!res.ok) return;
    const json = (await res.json()) as { children: Record<string, ChildRow[]>; sums: Record<string, number> };
    setChildren((prev) => ({ ...prev, ...(json.children ?? {}) }));
    setRemainingSums((prev) => ({ ...prev, ...(json.sums ?? {}) }));
  };

  const ensureSumsLoaded = async (ids: number[]) => {
    const missing = ids.filter((id) => remainingSums[String(id)] == null);
    if (!missing.length) return;
    const chunks: number[][] = [];
    for (let i = 0; i < missing.length; i += 150) chunks.push(missing.slice(i, i + 150));
    for (const c of chunks) await fetchChildrenBatch(c);
  };

  const baseFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return wis.filter((w) => !s || w.title?.toLowerCase().includes(s) || String(w.id).includes(s));
  }, [wis, search]);

  const avgDaysByStatus = useMemo(() => {
    const agg: Record<string, { total: number; items: number }> = {};
    for (const w of baseFiltered) {
      const tbs = w.timeByStatus ?? {};
      for (const [st, days] of Object.entries(tbs)) {
        const d = Number(days);
        if (!Number.isFinite(d) || d <= 0) continue;
        if (!agg[st]) agg[st] = { total: 0, items: 0 };
        agg[st].total += d;
        agg[st].items += 1;
      }
    }
    const rows = Object.entries(agg)
      .map(([state, a]) => ({
        state,
        avgDays: a.items ? a.total / a.items : 0,
        items: a.items,
      }))
      .sort((a, b) => b.avgDays - a.avgDays);
    const max = Math.max(1, ...rows.map((r) => r.avgDays));
    return { rows, max };
  }, [baseFiltered]);

  useEffect(() => {
    // Preload sums for the current visible list so the Remaining Σ column is filled.
    const ids = baseFiltered.map((w) => w.id);
    void ensureSumsLoaded(ids);
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    const base = baseFiltered;
    if (!sort) return base;

    const dirMul = sort.dir === "asc" ? 1 : -1;
    const normText = (v: unknown) => (v == null ? "" : String(v)).toLowerCase();
    const normNum = (v: unknown) => (v == null || v === "—" ? Number.NaN : Number(v));
    const stateRank = (state?: string) => {
      const s = (state ?? "").trim();
      const order: string[] = [
        "New",
        "Approved",
        "Design",
        "To Do",
        "Committed",
        "In Progress",
        "Testing",
        "Wait Client",
        "Ready",
        "Done",
        "Removed",
      ];
      const idx = order.indexOf(s);
      return idx >= 0 ? idx : 999;
    };

    return base.slice().sort((a, b) => {
      const key = sort.key;
      if (key === "id") return (a.id - b.id) * dirMul;
      if (key === "state") return (stateRank(a.state) - stateRank(b.state)) * dirMul;
      if (key === "remainingSum") {
        const av = remainingSums[String(a.id)] ?? 0;
        const bv = remainingSums[String(b.id)] ?? 0;
        return (av - bv) * dirMul;
      }
      if (key === "effort" || key === "leadTime" || key === "cycleTime") {
        const av = normNum((a as any)[key]);
        const bv = normNum((b as any)[key]);
        const aNan = Number.isNaN(av);
        const bNan = Number.isNaN(bv);
        if (aNan && bNan) return 0;
        if (aNan) return 1;
        if (bNan) return -1;
        return (av - bv) * dirMul;
      }

      const at = normText((a as any)[key]);
      const bt = normText((b as any)[key]);
      if (at < bt) return -1 * dirMul;
      if (at > bt) return  1 * dirMul;
      return 0;
    });
  }, [baseFiltered, sort, remainingSums]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const sortMark = (key: SortKey) => {
    if (!sort || sort.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  };

  return (
    <div>
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="text-sm font-semibold">
            {openBacklog ? "Backlog em aberto" : "PBIs do período"}
            <span className="text-[var(--text3)] font-normal font-mono"> ({wis.length})</span>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou ID..."
            className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text)] w-56" />
        </div>

        {wis.length === 0 ? (
          <div className="py-12 text-center text-[var(--text3)] text-sm">
            {openBacklog ? "Nenhum item em aberto encontrado." : "Nenhum PBI encontrado. Ajuste o período ou sincronize o time."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--bg3)] sticky top-0">
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap"> </th>
                  <th onClick={() => toggleSort("id")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">ID{sortMark("id")}</th>
                  <th onClick={() => toggleSort("title")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Título{sortMark("title")}</th>
                  <th onClick={() => toggleSort("state")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Estado{sortMark("state")}</th>
                  <th onClick={() => toggleSort("boardColumn")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Board{sortMark("boardColumn")}</th>
                  <th onClick={() => toggleSort("iteration")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Sprint{sortMark("iteration")}</th>
                  <th onClick={() => toggleSort("remainingSum")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Remaining Σ{sortMark("remainingSum")}</th>
                  <th onClick={() => toggleSort("effort")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Esforço{sortMark("effort")}</th>
                  <th onClick={() => toggleSort("leadTime")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Lead Time{sortMark("leadTime")}</th>
                  <th onClick={() => toggleSort("cycleTime")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Cycle Time{sortMark("cycleTime")}</th>
                  <th onClick={() => toggleSort("assignedTo")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Responsável{sortMark("assignedTo")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const isExpanded = Boolean(expanded[String(w.id)]);
                  const sum = remainingSums[String(w.id)];
                  const childs = children[String(w.id)] ?? [];
                  return (
                    <Fragment key={w.id}>
                      <tr key={w.id}
                        onClick={() => {
                          const next = !isExpanded;
                          setExpanded((p) => ({ ...p, [String(w.id)]: next }));
                          if (next && children[String(w.id)] == null) {
                            fetchChildrenBatch([w.id]);
                          }
                        }}
                        className={`cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--bg3)] ${isExpanded ? "bg-[rgba(14,165,233,.05)]" : ""}`}>
                        <td className="px-2 py-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = !isExpanded;
                              setExpanded((p) => ({ ...p, [String(w.id)]: next }));
                              if (next && children[String(w.id)] == null) {
                                fetchChildrenBatch([w.id]);
                              }
                            }}
                            className="w-6 h-6 rounded border border-[var(--border)] bg-[var(--bg3)] hover:border-[var(--accent)] text-[var(--text2)]"
                            title={isExpanded ? "Recolher" : "Expandir"}
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[var(--accent)]">
                          <a href={azureUrl(w.id)} target="_blank" rel="noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>{w.id}</a>
                        </td>
                        <td className="px-3 py-2.5 text-[var(--text)] max-w-[180px] truncate">
                          <a href={azureUrl(w.id)} target="_blank" rel="noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()} title={w.title ?? ""}>{w.title}</a>
                        </td>
                        <td className="px-3 py-2.5"><StateBadge state={w.state} /></td>
                        <td className="px-3 py-2.5 text-[var(--text2)] text-[11px]">{w.boardColumn ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-[var(--text3)] text-[10px]">{w.iteration ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono">{sum != null ? sum.toFixed(1) : "—"}</td>
                        <td className="px-3 py-2.5 font-mono">{w.effort ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono" style={{ color: (w.leadTime ?? 0) > 15 ? "var(--danger)" : "var(--text2)" }}>{w.leadTime != null ? `${w.leadTime.toFixed(1)}d` : "—"}</td>
                        <td className="px-3 py-2.5 font-mono" style={{ color: (w.cycleTime ?? 0) > 10 ? "var(--warn)" : "var(--text2)" }}>{w.cycleTime != null ? `${w.cycleTime.toFixed(1)}d` : "—"}</td>
                        <td className="px-3 py-2.5 text-[var(--text2)] text-[11px]">{w.assignedTo ?? "—"}</td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${w.id}_children`} className="border-b border-[var(--border)]">
                          <td colSpan={11} className="px-5 py-3 bg-[rgba(148,163,184,.06)]">
                            <div className="grid grid-cols-2 gap-5 mb-4">
                              <div>
                                <div className="text-xs font-semibold text-[var(--text2)] mb-3">Histórico de estados</div>
                                {(w.statusTimeline ?? []).map((e, i, arr) => (
                                  <div key={i} className="flex gap-2.5">
                                    <div className="flex flex-col items-center">
                                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" style={{ background: STATE_COLORS[e.state] ?? "#6b7280" }} />
                                      {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-[var(--border)] mx-auto my-0.5 min-h-[12px]" />}
                                    </div>
                                    <div className="pb-3">
                                      <div className="text-xs font-semibold" style={{ color: STATE_COLORS[e.state] }}>{e.state}</div>
                                      <div className="text-[10px] text-[var(--text3)] font-mono">
                                        {new Date(e.startDate).toLocaleDateString("pt-BR")} → {new Date(e.endDate).toLocaleDateString("pt-BR")}
                                      </div>
                                      <div className="text-[11px] text-[var(--text2)]">{e.duration.toFixed(1)} dias</div>
                                    </div>
                                  </div>
                                ))}
                                {!w.statusTimeline?.length && <p className="text-xs text-[var(--text3)]">Nenhuma revisão disponível</p>}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-[var(--text2)] mb-3">Tempo acumulado por estado</div>
                                {Object.entries(w.timeByStatus ?? {}).sort((a, b) => b[1] - a[1]).map(([st, days]) => (
                                  <FlowBar key={st} label={st} value={days} max={Math.max(...Object.values(w.timeByStatus ?? { _: 1 }))} color={STATE_COLORS[st] ?? "#6b7280"} />
                                ))}
                              </div>
                            </div>
                            {!childs.length ? (
                              <div className="text-[11px] text-[var(--text3)]">Sem Tasks/Bugs filhos.</div>
                            ) : (
                              <div className="grid grid-cols-3 gap-3">
                                {([
                                  { key: "todo" as const, label: "To Do" },
                                  { key: "inprogress" as const, label: "In Progress" },
                                  { key: "done" as const, label: "Done" },
                                ]).map((col) => {
                                  const list = childs.filter((c) => laneForChildState(c.state) === col.key);
                                  return (
                                    <div key={col.key} className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg overflow-hidden">
                                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] bg-[var(--bg3)] border-b border-[var(--border)]">
                                        {col.label} <span className="font-mono">({list.length})</span>
                                      </div>
                                      <div className="p-2 space-y-2">
                                        {list.length === 0 ? (
                                          <div className="text-[11px] text-[var(--text3)] px-1 py-1">—</div>
                                        ) : list.map((c) => (
                                          <div
                                            key={c.id}
                                            className={`border rounded-lg px-3 py-2 ${
                                              (c.type ?? "").toLowerCase() === "bug"
                                                ? "bg-[rgba(239,68,68,.06)] border-[rgba(239,68,68,.25)]"
                                                : "bg-[var(--bg3)] border-[var(--border)]"
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-3">
                                              <a href={azureUrl(c.id)} target="_blank" rel="noreferrer" className="min-w-0 text-[11px] text-[var(--text)] hover:underline">
                                                <div className="truncate">
                                                  <span className="font-mono text-[var(--accent)]">{c.id}</span>
                                                  <span className="text-[var(--text3)]"> — </span>
                                                  <span>{c.title ?? "—"}</span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text3)]">
                                                  <span className="truncate max-w-[180px]">{c.assignedTo ?? "—"}</span>
                                                  <span>·</span>
                                                  <span>{c.type ?? "—"}</span>
                                                  <span>·</span>
                                                  <StateBadge state={c.state ?? undefined} />
                                                </div>
                                              </a>
                                              <div className="flex-shrink-0 text-right">
                                                <div className="text-[10px] text-[var(--text3)]">Remaining</div>
                                                <div className="font-mono text-[11px] font-semibold text-[var(--text2)]">
                                                  {c.remainingWork != null ? c.remainingWork.toFixed(1) : "—"}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
