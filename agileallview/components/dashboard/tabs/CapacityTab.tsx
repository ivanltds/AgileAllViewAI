"use client";
import { KpiCard } from "@/components/ui/KpiCard";
import { FlowBar } from "@/components/ui/FlowBar";

const ACTIVITY_COLORS: Record<string,string> = {
  Development: "var(--accent)", Testing: "var(--success)", Design: "var(--purple)",
  Documentation: "var(--warn)", Deployment: "#f97316",
};

type MC = { memberId:string; memberName:string; activities:{name:string;capacityPerDay:number}[]; daysOff:{start:string;end:string}[]; totalCapacity:number; realCapacity:number; workingDays:number; dayOffCount:number };
type IC = { name:string; currentWeek:number; avgWeekly:number; variance:number };

export function CapacityTab({ data }: { data: Record<string,unknown>|null }) {
  const members = (data?.memberCapacities as MC[]) ?? [];
  const indCap  = (data?.individualCapacity as IC[]) ?? [];
  const sprint  = data?.currentSprint as { name?:string; start_date?:string; finish_date?:string } | null;

  const totalPlanned = members.reduce((s, m) => s + m.totalCapacity, 0);
  const totalReal    = members.reduce((s, m) => s + m.realCapacity,  0);
  const totalDayOffs = members.reduce((s, m) => s + m.dayOffCount,   0);

  const actBreak: Record<string,number> = {};
  for (const m of members) {
    for (const a of m.activities) {
      actBreak[a.name] = (actBreak[a.name] ?? 0) + a.capacityPerDay * (m.workingDays - m.dayOffCount);
    }
  }
  const maxAct = Math.max(1, ...Object.values(actBreak));

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5 mb-5">
        <KpiCard label="Membros"           value={members.length}             color="var(--accent)"  />
        <KpiCard label="Cap. planejada"    value={`${totalPlanned.toFixed(0)}h`} color="var(--warn)" />
        <KpiCard label="Cap. real"         value={`${totalReal.toFixed(0)}h`} color="var(--success)"  />
        <KpiCard label="Impacto day offs"  value={`${(totalPlanned - totalReal).toFixed(0)}h`} color="var(--danger)" />
        <KpiCard label="Dias de ausência"  value={totalDayOffs}               color="var(--purple)"  />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Members list */}
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">
            Capacidade por membro{sprint?.name ? ` — ${sprint.name}` : ""}
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-[var(--text3)]">Sincronize para ver a capacidade</p>
          ) : members.map((m) => (
            <div key={m.memberId} className="flex items-center gap-3 bg-[var(--bg3)] rounded-lg px-3 py-2.5 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--purple)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {m.memberName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{m.memberName}</div>
                <div className="text-[10px] text-[var(--text3)] mt-0.5">
                  {m.activities.map((a) => a.name).join(", ")} · {m.workingDays - m.dayOffCount}d disponíveis
                </div>
                <div className="h-1 bg-[var(--bg4)] rounded mt-1.5 overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded transition-all" style={{ width: `${totalPlanned > 0 ? (m.realCapacity / totalPlanned) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold font-mono text-[var(--accent)]">{m.realCapacity.toFixed(0)}h</div>
                {m.dayOffCount > 0 && <div className="text-[10px] text-[var(--warn)]">⚠ {m.dayOffCount}d off</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {/* Activity breakdown */}
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
            <div className="text-sm font-semibold mb-4">Distribuição por Activity</div>
            {Object.keys(actBreak).length === 0
              ? <p className="text-sm text-[var(--text3)]">Sem dados de activities</p>
              : Object.entries(actBreak).map(([act, hrs]) => (
              <FlowBar key={act} label={act} value={hrs} max={maxAct} color={ACTIVITY_COLORS[act] ?? "var(--accent)"} />
            ))}
          </div>

          {/* Day offs */}
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
            <div className="text-sm font-semibold mb-3">Day Offs nesta sprint</div>
            {members.filter((m) => m.dayOffCount > 0).length === 0 ? (
              <div className="text-sm text-[var(--success)] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                Nenhum day off registrado
              </div>
            ) : (
              members.filter((m) => m.dayOffCount > 0).map((m) => (
                <div key={m.memberId} className="bg-[rgba(245,158,11,.06)] border border-[rgba(245,158,11,.2)] rounded-lg px-3 py-2.5 mb-2">
                  <div className="text-xs font-semibold">{m.memberName}</div>
                  <div className="text-xs text-[var(--warn)] mt-0.5">🗓 {m.dayOffCount} dia{m.dayOffCount > 1 ? "s" : ""} de ausência</div>
                  <div className="text-[10px] text-[var(--text3)] mt-0.5">Impacto: -{(m.totalCapacity - m.realCapacity).toFixed(0)}h</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Individual capacity */}
      {indCap.length > 0 && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Capacidade individual — últimas 4 semanas</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg3)]">
                  {["Membro","Semana atual","Média 4 sem","Variação"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide border-b border-[var(--border)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {indCap.map((m) => (
                  <tr key={m.name} className="border-b border-[var(--border)] hover:bg-[var(--bg3)] transition-colors">
                    <td className="px-3 py-2.5 font-medium text-[var(--text)]">{m.name}</td>
                    <td className="px-3 py-2.5 font-mono font-bold text-[var(--accent)]">{m.currentWeek.toFixed(1)}h</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--text2)]">{m.avgWeekly.toFixed(1)}h</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${m.variance >= 0 ? "bg-[rgba(34,197,94,.1)] text-[var(--success)]" : "bg-[rgba(239,68,68,.1)] text-[var(--danger)]"}`}>
                        {m.variance >= 0 ? "+" : ""}{m.variance.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
