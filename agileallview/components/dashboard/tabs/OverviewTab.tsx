"use client";
import { KpiCard } from "@/components/ui/KpiCard";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line, BarChart, Bar } from "recharts";
import { useMemo, useState } from "react";

const PHASE_COLORS: Record<string, string> = {
  backlog: "#6366f1", desenvolvimento: "#f59e0b", qualidade: "#06b6d4",
  validacao: "#ec4899", pronto: "#10b981", concluido: "#22c55e", cancelado: "#ef4444",
};

function percentileValue(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

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

function HelpButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 rounded-full bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] text-sm font-bold flex items-center justify-center"
      aria-label="Dúvida"
      title={isOpen ? "Fechar ajuda" : "O que esse gráfico mostra?"}
    >
      ?
    </button>
  );
}

function EmptyChart({ title, message }: { title: string; message?: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-center px-6">
      <div>
        <div className="text-sm font-semibold mb-1">{title}</div>
        <div className="text-[12px] text-[var(--text2)]">{message ?? "Sem dados no período selecionado."}</div>
      </div>
    </div>
  );
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
  const sprintMetrics = (data?.sprintMetrics as {planned:number;completed:number;throughput:number}[]) ?? [];
  const workItems = (data?.workItems as {state:string;leadTime:number|null;cycleTime:number|null;timeByStatus:Record<string,number>}[]) ?? [];
  const leadTimeValues = (data?.leadTimeValues as number[]) ?? [];
  const cycleTimeValues = (data?.cycleTimeValues as number[]) ?? [];
  const leadTimeByDeliveryWeek = (data?.leadTimeByDeliveryWeek as {week:string;count:number;p50:number|null;p85:number|null;p95:number|null}[]) ?? [];
  const cycleTimeByDeliveryWeek = (data?.cycleTimeByDeliveryWeek as {week:string;count:number;p50:number|null;p85:number|null;p95:number|null}[]) ?? [];

  const [leadPct, setLeadPct] = useState<number>(90);
  const [cyclePct, setCyclePct] = useState<number>(90);
  const [helpOpen, setHelpOpen] = useState<Record<string, boolean>>({});

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

  const hasSprintMetrics = sprintMetrics.length > 0;
  const hasPlannedScope = totalPlanned > 0;
  const hasThroughput = sprintMetrics.some((s: any) => Number(s.throughput ?? 0) > 0);

  const leadPctDays = useMemo(() => percentileValue(leadTimeValues, leadPct), [leadTimeValues, leadPct]);
  const cyclePctDays = useMemo(() => percentileValue(cycleTimeValues, cyclePct), [cycleTimeValues, cyclePct]);

  const hasLeadDeliveries = leadTimeValues.length > 0 || leadTimeByDeliveryWeek.some((w) => (w.count ?? 0) > 0);
  const hasCycleDeliveries = cycleTimeValues.length > 0 || cycleTimeByDeliveryWeek.some((w) => (w.count ?? 0) > 0);

  const leadByDeliveryWeekData = useMemo(() => {
    return leadTimeByDeliveryWeek.map((w) => ({
      name: w.week,
      P50: w.p50 != null ? parseFloat(w.p50.toFixed(1)) : null,
      P85: w.p85 != null ? parseFloat(w.p85.toFixed(1)) : null,
      P95: w.p95 != null ? parseFloat(w.p95.toFixed(1)) : null,
      Count: w.count,
    }));
  }, [leadTimeByDeliveryWeek]);

  const cycleByDeliveryWeekData = useMemo(() => {
    return cycleTimeByDeliveryWeek.map((w) => ({
      name: w.week,
      P50: w.p50 != null ? parseFloat(w.p50.toFixed(1)) : null,
      P85: w.p85 != null ? parseFloat(w.p85.toFixed(1)) : null,
      P95: w.p95 != null ? parseFloat(w.p95.toFixed(1)) : null,
      Count: w.count,
    }));
  }, [cycleTimeByDeliveryWeek]);

  const plannedVsRealizedData = useMemo(() => {
    return sprintMetrics.map((s: any, idx) => ({
      name: sprintLabel(String(s.sprintName ?? `Sprint ${idx + 1}`)),
      Planejado: Number(s.planned ?? 0),
      Concluido: Number(s.completed ?? 0),
      Extras: Number(s.extraAdded ?? 0),
      Throughput: Number(s.throughput ?? 0),
    }));
  }, [sprintMetrics]);

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3.5 mb-5">
        <KpiCard label="Lead Time Médio"   value={avgLead  != null ? `${avgLead.toFixed(1)}d`  : "—"} color="var(--accent)"  icon={<ClockIcon/>}  bg="rgba(14,165,233,.1)" />
        <KpiCard label="Cycle Time Médio"  value={avgCycle != null ? `${avgCycle.toFixed(1)}d` : "—"} color="var(--purple)" icon={<ZapIcon/>}    bg="rgba(139,92,246,.1)" />
        <KpiCard label="Throughput/sprint" value={hasSprintMetrics && hasThroughput ? avgThrough : "—"}  color="var(--success)" icon={<ChartIcon/>}  bg="rgba(34,197,94,.1)"  />
        <KpiCard label="Taxa de conclusão" value={hasSprintMetrics && hasPlannedScope ? `${completionRate}%` : "—"} color="var(--warn)"    icon={<TargetIcon/>} bg="rgba(245,158,11,.1)" />
        <KpiCard label="PBIs concluídos"   value={done.length}   color="var(--pink)"   icon={<CheckIcon/>}  bg="rgba(236,72,153,.1)" />
        <KpiCard label="PBIs analisados"   value={workItems.length} color="var(--text2)" icon={<GridIcon/>} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Planejado vs Realizado (por sprint)</div>
            <HelpButton
              isOpen={Boolean(helpOpen.plan)}
              onClick={() => setHelpOpen((v) => ({ ...v, plan: !v.plan }))}
            />
          </div>
          {helpOpen.plan && (
            <div className="text-[12px] text-[var(--text2)] mb-4 leading-relaxed">
              Planejado = itens que estavam no sprint no início. Realizado = itens concluídos dentro do período do sprint.
              Extras = itens adicionados após o início do sprint e também concluídos dentro do período.
            </div>
          )}
          {hasSprintMetrics && hasPlannedScope ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={plannedVsRealizedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip as any} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                <Bar dataKey="Planejado" stackId="a" fill="var(--text3)" />
                <Bar dataKey="Concluido" stackId="b" fill="var(--success)" />
                <Bar dataKey="Extras" stackId="b" fill="var(--warn)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px]">
              <EmptyChart title="Planejado vs Realizado" message="Sem dados de planejamento no período selecionado." />
            </div>
          )}
        </div>

        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Throughput (por sprint)</div>
            <HelpButton
              isOpen={Boolean(helpOpen.throughput)}
              onClick={() => setHelpOpen((v) => ({ ...v, throughput: !v.throughput }))}
            />
          </div>
          {helpOpen.throughput && (
            <div className="text-[12px] text-[var(--text2)] mb-4 leading-relaxed">
              Throughput é o total de itens entregues no sprint (concluídos do planejado + extras concluídos dentro do período).
            </div>
          )}
          {hasSprintMetrics && hasThroughput ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={plannedVsRealizedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip as any} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                <Bar dataKey="Throughput" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px]">
              <EmptyChart title="Throughput" message="Sem entregas no período selecionado." />
            </div>
          )}
        </div>

        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Lead Time por semana de entrega (p50/p85/p95)</div>
            <HelpButton
              isOpen={Boolean(helpOpen.lead)}
              onClick={() => setHelpOpen((v) => ({ ...v, lead: !v.lead }))}
            />
          </div>
          {helpOpen.lead && (
            <div className="text-[12px] text-[var(--text2)] mb-4 leading-relaxed">
              Agrupa as demandas pela semana em que foram entregues (data de fechamento) e mostra a distribuição do Lead Time.
              As linhas p50/p85/p95 indicam em quantos dias a maior parte das demandas é entregue. O card ao lado permite ajustar o percentil e ler o SLE do período selecionado.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-stretch">
            <div>
              {hasLeadDeliveries ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={leadByDeliveryWeekData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={customTooltip as any} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                    <Line type="monotone" dataKey="P50" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="P85" stroke="var(--purple)" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="P95" stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart title="Lead Time" />
              )}
            </div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
              <div className="text-[11px] text-[var(--text3)] mb-2">Percentil</div>
              <div className="text-3xl font-bold font-mono leading-none">
                {leadPctDays != null ? `${Math.round(leadPctDays)}d` : "—"}
              </div>
              <div className="text-[11px] text-[var(--text2)] mt-2 leading-snug">
                {leadPct}% das demandas são entregues em {leadPctDays != null ? `${Math.round(leadPctDays)} dias` : "—"}
              </div>
              <div className="mt-auto pt-3">
                <input
                  type="range"
                  min={50}
                  max={99}
                  step={1}
                  value={leadPct}
                  onChange={(e) => setLeadPct(parseInt(e.target.value))}
                  className="w-full"
                  disabled={!hasLeadDeliveries}
                />
                <div className="flex justify-between text-[10px] text-[var(--text3)] mt-1">
                  <span>50%</span>
                  <span>99%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Cycle Time por semana de entrega (p50/p85/p95)</div>
            <HelpButton
              isOpen={Boolean(helpOpen.cycle)}
              onClick={() => setHelpOpen((v) => ({ ...v, cycle: !v.cycle }))}
            />
          </div>
          {helpOpen.cycle && (
            <div className="text-[12px] text-[var(--text2)] mb-4 leading-relaxed">
              Agrupa as demandas pela semana em que foram entregues (data de fechamento) e mostra a distribuição do Cycle Time.
              As linhas p50/p85/p95 indicam em quantos dias a maior parte das demandas é entregue. O card ao lado permite ajustar o percentil e ler o SLE do período selecionado.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-stretch">
            <div>
              {hasCycleDeliveries ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cycleByDeliveryWeekData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={customTooltip as any} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                    <Line type="monotone" dataKey="P50" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="P85" stroke="var(--purple)" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="P95" stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart title="Cycle Time" />
              )}
            </div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
              <div className="text-[11px] text-[var(--text3)] mb-2">Percentil</div>
              <div className="text-3xl font-bold font-mono leading-none">
                {cyclePctDays != null ? `${Math.round(cyclePctDays)}d` : "—"}
              </div>
              <div className="text-[11px] text-[var(--text2)] mt-2 leading-snug">
                {cyclePct}% das demandas são entregues em {cyclePctDays != null ? `${Math.round(cyclePctDays)} dias` : "—"}
              </div>
              <div className="mt-auto pt-3">
                <input
                  type="range"
                  min={50}
                  max={99}
                  step={1}
                  value={cyclePct}
                  onChange={(e) => setCyclePct(parseInt(e.target.value))}
                  className="w-full"
                  disabled={!hasCycleDeliveries}
                />
                <div className="flex justify-between text-[10px] text-[var(--text3)] mt-1">
                  <span>50%</span>
                  <span>99%</span>
                </div>
              </div>
            </div>
          </div>
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
