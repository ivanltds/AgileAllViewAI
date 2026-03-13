"use client";
import { KpiCard } from "@/components/ui/KpiCard";
import { FlowBar } from "@/components/ui/FlowBar";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useMemo, useState } from "react";

const PHASE_COLORS: Record<string, string> = {
  backlog: "#6366f1", desenvolvimento: "#f59e0b", qualidade: "#06b6d4",
  validacao: "#ec4899", pronto: "#10b981", concluido: "#22c55e", cancelado: "#ef4444",
};

const WORKFLOW_PHASES: Record<string, string[]> = {
  backlog:        ["New","Approved","Design","To Do"],
  desenvolvimento: ["Committed","In Progress"],
  qualidade:      ["Testing"],
  validacao:      ["Wait Client"],
  pronto:         ["Ready"],
  concluido:      ["Done"],
  cancelado:      ["Removed"],
};

function sprintLabel(sprintName: string): string {
  const m = sprintName.match(/(\d+)(?!.*\d)/);
  if (m?.[1]) return `Sprint ${m[1]}`;
  return sprintName;
}

const customTooltip = ({ active, payload, label }: any) => {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
      <div className="font-semibold mb-1">{String(label)}</div>
      {(payload as {name:string;value:number;color:string}[]).map((p) => (
        <div key={p.name} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: {typeof p.value === "number" ? p.value.toFixed?.(1) ?? p.value : p.value}
        </div>
      ))}
    </div>
  );
};

export function OverviewTab({ data }: { data: Record<string, unknown> | null }) {
  const sprintMetrics = (data?.sprintMetrics as {sprintName:string;planned:number;completed:number;extraAdded?:number;plannedEffort?:number;completedEffort?:number;extraEffort?:number;avgLeadTime:number|null;avgCycleTime:number|null;throughput:number}[]) ?? [];
  const workItems = (data?.workItems as {state:string;leadTime:number|null;cycleTime:number|null;timeByStatus:Record<string,number>}[]) ?? [];

  const [planVsRealMode, setPlanVsRealMode] = useState<"items" | "effort">("items");

  const done      = workItems.filter((w) => w.state === "Done");
  const leads     = done.map((w) => w.leadTime).filter((v): v is number => v != null);
  const cycles    = done.map((w) => w.cycleTime).filter((v): v is number => v != null);
  const avg       = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const avgLead   = avg(leads);
  const avgCycle  = avg(cycles);
  const totalPlanned   = sprintMetrics.reduce((s, x) => s + x.planned, 0);
  const totalCompleted = sprintMetrics.reduce((s, x) => s + x.completed, 0);
  const completionRate = totalPlanned ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  const avgThrough     = sprintMetrics.length ? (sprintMetrics.reduce((s, x) => s + x.throughput, 0) / sprintMetrics.length).toFixed(1) : "—";

  // Phase time aggregation
  const phaseTotals: Record<string, number> = {};
  for (const wi of workItems) {
    for (const [phase, states] of Object.entries(WORKFLOW_PHASES)) {
      for (const st of states) {
        const v = wi.timeByStatus?.[st];
        if (v) phaseTotals[phase] = (phaseTotals[phase] ?? 0) + v;
      }
    }
  }
  const nItems = workItems.length || 1;
  const maxPhase = Math.max(1, ...Object.values(phaseTotals));

  const planVsReal = useMemo(() => {
    return sprintMetrics.map((s) => {
      const name = sprintLabel(s.sprintName);
      if (planVsRealMode === "effort") {
        return {
          name,
          Planejado: s.plannedEffort ?? 0,
          Realizado: s.completedEffort ?? 0,
          Extra: s.extraEffort ?? 0,
        };
      }
      return {
        name,
        Planejado: s.planned,
        Realizado: s.completed,
        Extra: s.extraAdded ?? 0,
      };
    });
  }, [sprintMetrics, planVsRealMode]);

  const ltData = sprintMetrics.map((s) => ({
    name: sprintLabel(s.sprintName),
    "Lead Time": s.avgLeadTime != null ? parseFloat(s.avgLeadTime.toFixed(1)) : 0,
    "Cycle Time": s.avgCycleTime != null ? parseFloat(s.avgCycleTime.toFixed(1)) : 0,
  }));

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5 mb-5">
        <KpiCard label="Lead Time Médio"   value={avgLead  != null ? `${avgLead.toFixed(1)}d`  : "—"} color="var(--accent)"  icon={<ClockIcon/>}  bg="rgba(14,165,233,.1)" />
        <KpiCard label="Cycle Time Médio"  value={avgCycle != null ? `${avgCycle.toFixed(1)}d` : "—"} color="var(--purple)" icon={<ZapIcon/>}    bg="rgba(139,92,246,.1)" />
        <KpiCard label="Throughput/sprint" value={avgThrough}  color="var(--success)" icon={<ChartIcon/>}  bg="rgba(34,197,94,.1)"  />
        <KpiCard label="Taxa de conclusão" value={`${completionRate}%`} color="var(--warn)"    icon={<TargetIcon/>} bg="rgba(245,158,11,.1)" />
        <KpiCard label="PBIs concluídos"   value={done.length}   color="var(--pink)"   icon={<CheckIcon/>}  bg="rgba(236,72,153,.1)" />
        <KpiCard label="PBIs analisados"   value={workItems.length} color="var(--text2)" icon={<GridIcon/>} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">Planejado vs Realizado</div>
            <div className="flex items-center gap-1 bg-[var(--bg3)] border border-[var(--border)] rounded-lg p-1">
              <button
                type="button"
                onClick={() => setPlanVsRealMode("items")}
                className={
                  "px-2.5 py-1 rounded-md text-[11px] font-medium " +
                  (planVsRealMode === "items" ? "bg-[var(--bg2)] text-[var(--text1)]" : "text-[var(--text3)]")
                }
              >
                Itens
              </button>
              <button
                type="button"
                onClick={() => setPlanVsRealMode("effort")}
                className={
                  "px-2.5 py-1 rounded-md text-[11px] font-medium " +
                  (planVsRealMode === "effort" ? "bg-[var(--bg2)] text-[var(--text1)]" : "text-[var(--text3)]")
                }
              >
                Effort
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={planVsReal} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
              <Tooltip content={customTooltip as any} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
              <Bar dataKey="Planejado" fill="var(--accent)"  radius={[3,3,0,0]} />
              <Bar dataKey="Realizado" stackId="real" fill="var(--success)" radius={[3,3,0,0]} />
              <Bar dataKey="Extra" stackId="real" fill="var(--warn)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Lead Time & Cycle Time por Sprint (dias)</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={ltData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
              <Tooltip content={customTooltip as any} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
              <Bar dataKey="Lead Time"  fill="var(--purple)" radius={[3,3,0,0]} />
              <Bar dataKey="Cycle Time" fill="var(--accent)"  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Phase time + throughput */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Tempo médio por fase (dias/item)</div>
          {Object.entries(phaseTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([ph, val]) => (
            <FlowBar key={ph} label={ph.charAt(0).toUpperCase() + ph.slice(1)} value={val / nItems} max={maxPhase / nItems} color={PHASE_COLORS[ph]} />
          ))}
          {Object.keys(phaseTotals).length === 0 && <p className="text-[var(--text3)] text-sm">Sincronize para ver os dados</p>}
        </div>
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Throughput por Sprint</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={sprintMetrics.map((s) => ({ name: sprintLabel(s.sprintName), Throughput: s.throughput }))} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
              <Tooltip content={customTooltip as any} />
              <Bar dataKey="Throughput" fill="var(--success)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const ClockIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2"/></svg>;
const ZapIcon    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const ChartIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
const TargetIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z"/></svg>;
const CheckIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>;
const GridIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>;
// pink
declare module "react" { interface CSSProperties { ["--pink"]?: string } }
