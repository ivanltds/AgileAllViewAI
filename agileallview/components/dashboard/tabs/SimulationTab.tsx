"use client";
import { useState } from "react";
import type { TeamDto } from "@/lib/types";

const ACT_COLORS: Record<string,string> = {
  Development:"var(--accent)",Testing:"var(--success)",Design:"var(--purple)",
  Documentation:"var(--warn)",Deployment:"#f97316",
};
const TEAM_ACCENTS = ["#f59e0b","#ec4899","#10b981","#8b5cf6","#f97316"];

type IC = { name:string; avgWeekly:number; currentWeek?:number; activity?:string };

export function SimulationTab({ data, allTeams, teamId }: {
  data: Record<string,unknown>|null;
  allTeams: TeamDto[];
  teamId: string;
}) {
  const currentIndCap = (data?.individualCapacity as IC[]) ?? [];
  const otherTeams    = allTeams.filter((t) => t.id !== teamId);

  // Build member pools
  const currentPool = currentIndCap.map((m) => ({ ...m, teamId, teamName: allTeams.find((t) => t.id === teamId)?.name ?? "—", key: `${teamId}::${m.name}` }));

  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentPool.map((m) => m.key)));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [scenarios, setScenarios] = useState<{ id:number; label:string; count:number; weekly:number; sprint:number; teams:string; actBreak:Record<string,number> }[]>([]);

  const toggle    = (key: string) => setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleAll = (pool: {key:string}[]) => {
    const keys = pool.map((m) => m.key);
    const allIn = keys.every((k) => selected.has(k));
    setSelected((s) => { const n = new Set(s); keys.forEach((k) => allIn ? n.delete(k) : n.add(k)); return n; });
  };
  const toggleExp = (id: string) => setExpanded((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Other teams use placeholder data until synced
  const otherPools = otherTeams.map((t, ti) => ({
    team: t, accent: TEAM_ACCENTS[ti % TEAM_ACCENTS.length],
    members: (((t as unknown as { indCap?: IC[] }).indCap) ?? []).map((m) => ({
      ...m, teamId: t.id, teamName: t.name, key: `${t.id}::${m.name}`,
    })),
  }));

  const allPool = [...currentPool, ...otherPools.flatMap((p) => p.members)];
  const selMembers = allPool.filter((m) => selected.has(m.key));
  const weekly  = selMembers.reduce((s, m) => s + (m.avgWeekly ?? 0), 0);
  const sprint  = weekly * 2;
  const actBreak = selMembers.reduce<Record<string,number>>((acc, m) => {
    acc[m.activity ?? "Development"] = (acc[m.activity ?? "Development"] ?? 0) + (m.avgWeekly ?? 0);
    return acc;
  }, {});
  const teamNames = Array.from(new Set(selMembers.map((m) => m.teamName)));

  const saveScenario = () => {
    if (!selMembers.length) return;
    setScenarios((s) => [...s, {
      id: Date.now(), label: `Cenário ${s.length + 1}`,
      count: selMembers.length, weekly, sprint,
      teams: teamNames.join(", "), actBreak: { ...actBreak },
    }]);
  };

  const MRow = ({ m, accent }: { m: { key:string; name:string; avgWeekly?:number; activity?:string }; accent: string }) => (
    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--bg3)] rounded-lg mb-1.5 border-l-2" style={{ borderLeftColor: accent }}>
      <input type="checkbox" checked={selected.has(m.key)} onChange={() => toggle(m.key)}
        className="w-3.5 h-3.5 cursor-pointer accent-[var(--accent)]" />
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
        style={{ background: `linear-gradient(135deg,${accent},var(--purple))` }}>
        {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{m.name}</div>
        <div className="text-[10px] text-[var(--text3)]">{m.activity ?? "—"}</div>
      </div>
      <div className="text-xs font-mono text-[var(--accent)] flex-shrink-0">{(m.avgWeekly ?? 0).toFixed(1)}h/sem</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-4 items-start">
      {/* LEFT — member selection */}
      <div>
        {/* Current team */}
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              {allTeams.find((t) => t.id === teamId)?.name ?? "Time atual"}
              <span className="text-[10px] bg-[rgba(14,165,233,.12)] text-[var(--accent)] rounded-full px-2 py-0.5">atual</span>
            </div>
            <button onClick={() => toggleAll(currentPool)} className="text-xs text-[var(--text2)] hover:text-[var(--text)] bg-[var(--bg3)] border border-[var(--border)] rounded px-2.5 py-1 transition-all">
              {currentPool.every((m) => selected.has(m.key)) ? "Desmarcar" : "Todos"}
            </button>
          </div>
          {currentPool.length === 0
            ? <p className="text-xs text-[var(--text3)]">Sincronize para ver os membros</p>
            : currentPool.map((m) => <MRow key={m.key} m={m} accent="var(--accent)" />)
          }
        </div>

        {otherTeams.length > 0 && (
          <>
            <div className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2 px-1">Adicionar de outros times</div>
            {otherPools.map(({ team: t, accent, members }) => {
              const selCount = members.filter((m) => selected.has(m.key)).length;
              const isOpen = expanded.has(t.id);
              return (
                <div key={t.id} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4 mb-2" style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExp(t.id)}>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-[10px] text-[var(--text3)]">{t.org} / {t.project}</div>
                    </div>
                    {selCount > 0 && (
                      <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: accent + "25", color: accent }}>{selCount} sel.</span>
                    )}
                    <span className="text-[10px] text-[var(--text3)] transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>▼</span>
                  </div>
                  {isOpen && (
                    <div className="mt-3">
                      <div className="flex justify-end mb-2">
                        <button onClick={(e) => { e.stopPropagation(); toggleAll(members); }} className="text-xs text-[var(--text2)] hover:text-[var(--text)] bg-[var(--bg3)] border border-[var(--border)] rounded px-2.5 py-1">
                          {members.every((m) => selected.has(m.key)) ? "Desmarcar" : "Todos"}
                        </button>
                      </div>
                      {members.length === 0
                        ? <p className="text-xs text-[var(--text3)]">Sincronize este time para ver os membros</p>
                        : members.map((m) => <MRow key={m.key} m={m} accent={accent} />)
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* RIGHT — result */}
      <div className="sticky top-[68px]">
        <div className="bg-gradient-to-br from-[rgba(14,165,233,.07)] to-[rgba(139,92,246,.07)] border border-[rgba(14,165,233,.2)] rounded-xl p-6 text-center mb-4">
          <div className="text-[10px] text-[var(--text3)] uppercase tracking-wider mb-2">Capacidade simulada</div>
          <div className="text-[52px] font-bold font-mono text-[var(--accent)] leading-none">{weekly.toFixed(0)}h</div>
          <div className="text-xs text-[var(--text2)] mt-1">por semana · {selMembers.length} membros de {teamNames.length} time{teamNames.length !== 1 ? "s" : ""}</div>

          {Object.keys(actBreak).length > 0 && (
            <>
              <div className="flex gap-0.5 h-2 rounded overflow-hidden my-4">
                {Object.entries(actBreak).map(([a, h]) => (
                  <div key={a} style={{ flex: h, background: ACT_COLORS[a] ?? "var(--accent)" }} title={`${a}: ${h.toFixed(0)}h`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center text-[10px] text-[var(--text2)]">
                {Object.entries(actBreak).map(([a, h]) => (
                  <span key={a} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ background: ACT_COLORS[a] ?? "var(--accent)" }} />
                    {a} ({h.toFixed(0)}h)
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-[var(--bg3)] rounded-lg py-3">
              <div className="text-xl font-bold font-mono text-[var(--success)]">{sprint.toFixed(0)}h</div>
              <div className="text-[10px] text-[var(--text3)] mt-0.5">por sprint (2 sem)</div>
            </div>
            <div className="bg-[var(--bg3)] rounded-lg py-3">
              <div className="text-xl font-bold font-mono text-[var(--warn)]">{(weekly / 8).toFixed(1)}</div>
              <div className="text-[10px] text-[var(--text3)] mt-0.5">dias-pessoa/sem</div>
            </div>
          </div>

          {selMembers.length > 0 && (
            <div className="mt-3 bg-[rgba(255,255,255,.04)] rounded-lg p-3 text-left">
              {teamNames.map((tn) => {
                const ms = selMembers.filter((m) => m.teamName === tn);
                return (
                  <div key={tn} className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text2)]">{tn}</span>
                    <span className="font-mono text-[var(--accent)]">{ms.length}p · {ms.reduce((s, m) => s + (m.avgWeekly ?? 0), 0).toFixed(0)}h/sem</span>
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={saveScenario} disabled={!selMembers.length}
            className="w-full mt-4 bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg py-2 text-sm font-medium hover:border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Salvar cenário
          </button>
        </div>

        {/* Scenarios */}
        {scenarios.length > 0 && (
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-sm font-semibold mb-3">Cenários comparados</div>
            {scenarios.map((s) => (
              <div key={s.id} className="bg-[var(--bg3)] rounded-lg p-3 mb-2.5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs font-semibold text-[var(--accent)]">{s.label}</div>
                    <div className="text-[10px] text-[var(--text3)]">{s.teams}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono text-[var(--success)]">{s.sprint.toFixed(0)}h/sprint</div>
                    <div className="text-[10px] text-[var(--text3)]">{s.count} membros</div>
                  </div>
                </div>
                <div className="flex gap-0.5 h-1.5 rounded overflow-hidden">
                  {Object.entries(s.actBreak).map(([a, h]) => (
                    <div key={a} style={{ flex: h, background: ACT_COLORS[a] ?? "var(--accent)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
