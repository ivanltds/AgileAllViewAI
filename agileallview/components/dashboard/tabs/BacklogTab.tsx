"use client";
import { useMemo, useState } from "react";
import { StateBadge } from "@/components/ui/Badge";
import { FlowBar } from "@/components/ui/FlowBar";

const STATE_COLORS: Record<string,string> = {
  New:"#6b7280",Approved:"#8b5cf6",Design:"#a78bfa","To Do":"#3b82f6",
  Committed:"#f59e0b","In Progress":"#f97316",Testing:"#06b6d4",
  "Wait Client":"#ec4899",Ready:"#10b981",Done:"#22c55e",Removed:"#ef4444",
};

type WI = { id:number; title?:string; state?:string; boardColumn?:string|null; iteration?:string; assignedTo?:string; effort?:number|null; leadTime?:number|null; cycleTime?:number|null; statusTimeline?:{state:string;startDate:string;endDate:string;duration:number}[]; timeByStatus?:Record<string,number> };

type SortKey = "id" | "title" | "state" | "boardColumn" | "iteration" | "effort" | "leadTime" | "cycleTime" | "assignedTo";

export function BacklogTab({ data, openBacklog }: { data: Record<string,unknown>|null; openBacklog?: boolean }) {
  const wis = (data?.workItems as WI[]) ?? [];
  const [sel, setSel] = useState<WI|null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>({ key: "id", dir: "desc" });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const base = wis.filter((w) =>
      !s || w.title?.toLowerCase().includes(s) || String(w.id).includes(s)
    );

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
  }, [wis, search, sort]);

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
                  <th onClick={() => toggleSort("id")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">ID{sortMark("id")}</th>
                  <th onClick={() => toggleSort("title")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Título{sortMark("title")}</th>
                  <th onClick={() => toggleSort("state")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Estado{sortMark("state")}</th>
                  <th onClick={() => toggleSort("boardColumn")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Board{sortMark("boardColumn")}</th>
                  <th onClick={() => toggleSort("iteration")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Sprint{sortMark("iteration")}</th>
                  <th onClick={() => toggleSort("effort")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Esforço{sortMark("effort")}</th>
                  <th onClick={() => toggleSort("leadTime")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Lead Time{sortMark("leadTime")}</th>
                  <th onClick={() => toggleSort("cycleTime")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Cycle Time{sortMark("cycleTime")}</th>
                  <th onClick={() => toggleSort("assignedTo")} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)] whitespace-nowrap cursor-pointer select-none">Responsável{sortMark("assignedTo")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} onClick={() => setSel(sel?.id === w.id ? null : w)}
                    className={`cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--bg3)] ${sel?.id === w.id ? "bg-[rgba(14,165,233,.05)]" : ""}`}>
                    <td className="px-3 py-2.5 font-mono text-[var(--accent)]">{w.id}</td>
                    <td className="px-3 py-2.5 text-[var(--text)] max-w-[180px] truncate">{w.title}</td>
                    <td className="px-3 py-2.5"><StateBadge state={w.state} /></td>
                    <td className="px-3 py-2.5 text-[var(--text2)] text-[11px]">{w.boardColumn ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--text3)] text-[10px]">{w.iteration ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono">{w.effort ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: (w.leadTime ?? 0) > 15 ? "var(--danger)" : "var(--text2)" }}>{w.leadTime != null ? `${w.leadTime.toFixed(1)}d` : "—"}</td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: (w.cycleTime ?? 0) > 10 ? "var(--warn)" : "var(--text2)" }}>{w.cycleTime != null ? `${w.cycleTime.toFixed(1)}d` : "—"}</td>
                    <td className="px-3 py-2.5 text-[var(--text2)] text-[11px]">{w.assignedTo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {sel && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-sm font-semibold">#{sel.id} — {sel.title}</div>
              <StateBadge state={sel.state} />
            </div>
            <button onClick={() => setSel(null)} className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg3)] rounded transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="text-xs font-semibold text-[var(--text2)] mb-3">Histórico de estados</div>
              {(sel.statusTimeline ?? []).map((e, i, arr) => (
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
              {!sel.statusTimeline?.length && <p className="text-xs text-[var(--text3)]">Nenhuma revisão disponível</p>}
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--text2)] mb-3">Tempo acumulado por estado</div>
              {Object.entries(sel.timeByStatus ?? {}).sort((a, b) => b[1] - a[1]).map(([st, days]) => (
                <FlowBar key={st} label={st} value={days} max={Math.max(...Object.values(sel.timeByStatus ?? { _: 1 }))} color={STATE_COLORS[st] ?? "#6b7280"} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
