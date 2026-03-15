"use client";
import { KpiCard } from "@/components/ui/KpiCard";
import { FlowBar } from "@/components/ui/FlowBar";
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

const STATUS_COLORS: Record<string, string> = {
  // Planning
  New: "#6b7280",
  "To Do": "#6b7280",
  Design: "#6b7280",
  Planned: "#6b7280",
  Planning: "#6b7280",
  // Approved
  Approved: "#e5e7eb",
  // In progress
  Committed: "#3b82f6",
  "In Progress": "#3b82f6",
  Active: "#3b82f6",
  Doing: "#3b82f6",
  // Testing
  Testing: "#f97316",
  Test: "#f97316",
  QA: "#f97316",
  Ready: "#f97316",
  // Done
  Done: "#22c55e",
  Closed: "#22c55e",
  Resolved: "#22c55e",
  // Removed
  Removed: "#ef4444",
};

function sprintLabel(sprintName: string): string {
  const m = sprintName.match(/(\d+)(?!.*\d)/);
  if (m?.[1]) return `Sprint ${m[1]}`;
  return sprintName;
}

function regressionTrend(values: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  if (values.length < 2) return null;
  const n = values.length;
  const sumX = values.reduce((s, p) => s + p.x, 0);
  const sumY = values.reduce((s, p) => s + p.y, 0);
  const sumXY = values.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = values.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (!Number.isFinite(denom) || denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  return { slope, intercept };
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
  const sprintMetrics = (data?.sprintMetrics as { planned:number; completed:number; throughput:number; extraAdded?: number; plannedEffort?: number; completedEffort?: number; extraEffort?: number }[]) ?? [];
  const workItems = (data?.workItems as {state:string;leadTime:number|null;cycleTime:number|null;timeByStatus:Record<string,number>}[]) ?? [];
  const leadTimeValues = (data?.leadTimeValues as number[]) ?? [];
  const cycleTimeValues = (data?.cycleTimeValues as number[]) ?? [];
  const leadTimeByDeliveryWeek = (data?.leadTimeByDeliveryWeek as {week:string;count:number;avg:number|null;min:number|null;max:number|null;p50:number|null;p85:number|null;p95:number|null}[]) ?? [];
  const cycleTimeByDeliveryWeek = (data?.cycleTimeByDeliveryWeek as {week:string;count:number;avg:number|null;min:number|null;max:number|null;p50:number|null;p85:number|null;p95:number|null}[]) ?? [];

  const [leadPct, setLeadPct] = useState<number>(90);
  const [cyclePct, setCyclePct] = useState(85);
  const [leadMode, setLeadMode] = useState<"pct" | "summary">("pct");
  const [cycleMode, setCycleMode] = useState<"pct" | "summary">("pct");
  const [leadViz, setLeadViz] = useState<"lines" | "scatter">("lines");
  const [cycleViz, setCycleViz] = useState<"lines" | "scatter">("lines");
  const [planMetric, setPlanMetric] = useState<"items" | "effort">("items");
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
    return leadTimeByDeliveryWeek.map((w, idx) => ({
      name: w.week,
      x: idx,
      P50: w.p50 != null ? parseFloat(w.p50.toFixed(1)) : null,
      P85: w.p85 != null ? parseFloat(w.p85.toFixed(1)) : null,
      P95: w.p95 != null ? parseFloat(w.p95.toFixed(1)) : null,
      Media: w.avg != null ? parseFloat(w.avg.toFixed(1)) : null,
      Min: w.min != null ? parseFloat(w.min.toFixed(1)) : null,
      Max: w.max != null ? parseFloat(w.max.toFixed(1)) : null,
      Count: w.count,
    }));
  }, [leadTimeByDeliveryWeek]);

  const cycleByDeliveryWeekData = useMemo(() => {
    return cycleTimeByDeliveryWeek.map((w, idx) => ({
      name: w.week,
      x: idx,
      P50: w.p50 != null ? parseFloat(w.p50.toFixed(1)) : null,
      P85: w.p85 != null ? parseFloat(w.p85.toFixed(1)) : null,
      P95: w.p95 != null ? parseFloat(w.p95.toFixed(1)) : null,
      Media: w.avg != null ? parseFloat(w.avg.toFixed(1)) : null,
      Min: w.min != null ? parseFloat(w.min.toFixed(1)) : null,
      Max: w.max != null ? parseFloat(w.max.toFixed(1)) : null,
      Count: w.count,
    }));
  }, [cycleTimeByDeliveryWeek]);

  const leadSummary = useMemo(() => {
    if (!leadTimeValues.length) return { avg: null as number | null, min: null as number | null, max: null as number | null };
    const min = Math.min(...leadTimeValues);
    const max = Math.max(...leadTimeValues);
    const avg = leadTimeValues.reduce((s, v) => s + v, 0) / leadTimeValues.length;
    return { avg, min, max };
  }, [leadTimeValues]);

  const cycleSummary = useMemo(() => {
    if (!cycleTimeValues.length) return { avg: null as number | null, min: null as number | null, max: null as number | null };
    const min = Math.min(...cycleTimeValues);
    const max = Math.max(...cycleTimeValues);
    const avg = cycleTimeValues.reduce((s, v) => s + v, 0) / cycleTimeValues.length;
    return { avg, min, max };
  }, [cycleTimeValues]);

  const leadTrendData = useMemo(() => {
    const points = leadByDeliveryWeekData
      .map((d) => ({ x: Number(d.x), y: Number(d.Media) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const reg = regressionTrend(points);
    if (!reg) return leadByDeliveryWeekData.map((d) => ({ ...d, Tendencia: null as number | null }));
    return leadByDeliveryWeekData.map((d) => ({
      ...d,
      Tendencia: Number.isFinite(d.x) ? parseFloat((reg.intercept + reg.slope * Number(d.x)).toFixed(1)) : null,
    }));
  }, [leadByDeliveryWeekData]);

  const cycleTrendData = useMemo(() => {
    const points = cycleByDeliveryWeekData
      .map((d) => ({ x: Number(d.x), y: Number(d.Media) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const reg = regressionTrend(points);
    if (!reg) return cycleByDeliveryWeekData.map((d) => ({ ...d, Tendencia: null as number | null }));
    return cycleByDeliveryWeekData.map((d) => ({
      ...d,
      Tendencia: Number.isFinite(d.x) ? parseFloat((reg.intercept + reg.slope * Number(d.x)).toFixed(1)) : null,
    }));
  }, [cycleByDeliveryWeekData]);

  const plannedVsRealizedData = useMemo(() => {
    return sprintMetrics.map((s: any, idx) => ({
      name: sprintLabel(String(s.sprintName ?? `Sprint ${idx + 1}`)),
      Planejado: planMetric === "effort" ? Number(s.plannedEffort ?? 0) : Number(s.planned ?? 0),
      Concluido: planMetric === "effort" ? Number(s.completedEffort ?? 0) : Number(s.completed ?? 0),
      Extras: planMetric === "effort" ? Number(s.extraEffort ?? 0) : Number(s.extraAdded ?? 0),
      Throughput: Number(s.throughput ?? 0),
    }));
  }, [sprintMetrics, planMetric]);

  const plannedTooltip = useMemo(() => {
    if (planMetric !== "effort") return customTooltip as any;
    return ({ active, payload, label }: any) => {
      if (!active || !Array.isArray(payload) || !payload.length) return null;
      return (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
          <div className="font-semibold mb-1">{String(label)}</div>
          {(payload as { name: string; value: number; color: string }[]).map((p) => (
            <div key={p.name} className="flex items-center gap-2" style={{ color: p.color }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
              {p.name}: {typeof p.value === "number" ? `${p.value.toFixed?.(1) ?? p.value} h/pts` : p.value}
            </div>
          ))}
        </div>
      );
    };
  }, [planMetric]);

  const openBugs = Number((data as any)?.quality?.bugs?.openCount ?? 0);
  const openDefects = Number((data as any)?.quality?.defects?.openCount ?? 0);

  const avgDaysByStatus = useMemo(() => {
    const agg: Record<string, { total: number; items: number }> = {};
    for (const w of workItems) {
      const tbs = (w as any).timeByStatus ?? {};
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
  }, [workItems]);

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
        <KpiCard label="Bugs abertos"      value={Number.isFinite(openBugs) ? openBugs : "—"} color="var(--danger)" icon={<BugIcon/>} bg="rgba(239,68,68,.1)" />
        <KpiCard label="Defeitos abertos"  value={Number.isFinite(openDefects) ? openDefects : "—"} color="var(--danger)" icon={<DefectIcon/>} bg="rgba(239,68,68,.1)" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-sm font-semibold">Planejado vs Realizado (por sprint)</div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPlanMetric("items")}
                className={`px-2.5 py-1 rounded text-[11px] transition-all ${planMetric === "items" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                Quantidade
              </button>
              <button
                onClick={() => setPlanMetric("effort")}
                className={`px-2.5 py-1 rounded text-[11px] transition-all ${planMetric === "effort" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                Esforço
              </button>
            </div>
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
                <Tooltip content={plannedTooltip as any} />
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
            <div className="min-w-0">
              <div className="text-sm font-semibold">Lead Time por semana de entrega</div>
              <div className="text-[10px] text-[var(--text3)] mt-1">Dias · por semana (fechamento)</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLeadViz("lines")}
                className={`px-2.5 py-1 rounded text-[11px] transition-all ${leadViz === "lines" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                Linhas
              </button>
              <button
                onClick={() => setLeadViz("scatter")}
                className={`px-2.5 py-1 rounded text-[11px] transition-all ${leadViz === "scatter" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                Dispersão
              </button>
              {leadViz === "lines" && (
                <>
                  <button
                    onClick={() => setLeadMode("pct")}
                    className={`px-2.5 py-1 rounded text-[11px] transition-all ${leadMode === "pct" ? "bg-[rgba(139,92,246,.12)] border border-[var(--purple)] text-[var(--purple)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--purple)] hover:text-[var(--purple)]"}`}
                  >
                    Percentis
                  </button>
                  <button
                    onClick={() => setLeadMode("summary")}
                    className={`px-2.5 py-1 rounded text-[11px] transition-all ${leadMode === "summary" ? "bg-[rgba(139,92,246,.12)] border border-[var(--purple)] text-[var(--purple)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--purple)] hover:text-[var(--purple)]"}`}
                  >
                    Mín/Méd/Máx
                  </button>
                </>
              )}
              <HelpButton
                isOpen={Boolean(helpOpen.lead)}
                onClick={() => setHelpOpen((v) => ({ ...v, lead: !v.lead }))}
              />
            </div>
          </div>
          {helpOpen.lead && (
            <div className="text-[12px] text-[var(--text2)] mb-4 leading-relaxed">
              Este gráfico agrupa as demandas pela semana em que foram entregues (data de fechamento) e mostra o Lead Time em dias.
              <br />
              <br />
              <span className="font-semibold">Lead Time</span> = tempo total desde a criação até a conclusão (inclui esperas em backlog, filas, validação etc.).
              <br />
              <br />
              <span className="font-semibold">Modo Linhas</span>:
              <br />
              - <span className="font-semibold">Percentis</span> (P50/P85/P95): mostra a distribuição. Ex: P85 = 85% das entregas saem em até X dias.
              <br />
              - <span className="font-semibold">Mín/Méd/Máx</span>: mostra mínimo, média e máximo em cada semana (bom para identificar outliers e variação).
              <br />
              <br />
              <span className="font-semibold">Modo Dispersão</span>:
              <br />
              Mostra apenas a <span className="font-semibold">linha de tendência</span> (regressão linear) baseada na média semanal. Ao usar Dispersão, o seletor de percentis fica oculto.
              <br />
              <br />
              O card lateral muda conforme o modo: em percentis ele funciona como um <span className="font-semibold">SLE</span> (tempo alvo para X% das entregas); nos demais modos ele mostra resumo (média/mín/máx) do período.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-stretch">
            <div>
              {hasLeadDeliveries ? (
                leadViz === "scatter" ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={leadTrendData as any}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={customTooltip as any} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                      <Line type="monotone" dataKey="Tendencia" name="Tendência" stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={leadByDeliveryWeekData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={customTooltip as any} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                      {leadMode === "pct" ? (
                        <>
                          <Line type="monotone" dataKey="P50" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="P85" stroke="var(--purple)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="P95" stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" dataKey="Min" name="Mínimo" stroke="var(--purple)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="Media" name="Média" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="Max" name="Máximo" stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )
              ) : (
                <EmptyChart title="Lead Time" />
              )}
            </div>
            {leadViz === "lines" && leadMode === "pct" ? (
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
            ) : (
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
                <div className="text-[11px] text-[var(--text3)] mb-2">Resumo do período</div>
                <div className="text-[12px] text-[var(--text2)]">Média</div>
                <div className="text-2xl font-bold font-mono leading-none">
                  {leadSummary.avg != null ? `${leadSummary.avg.toFixed(1)}d` : "—"}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-[var(--text3)]">Mínimo</div>
                    <div className="text-[13px] font-mono font-semibold">{leadSummary.min != null ? `${Math.round(leadSummary.min)}d` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--text3)]">Máximo</div>
                    <div className="text-[13px] font-mono font-semibold">{leadSummary.max != null ? `${Math.round(leadSummary.max)}d` : "—"}</div>
                  </div>
                </div>
                <div className="mt-auto pt-3 text-[10px] text-[var(--text3)] font-mono">
                  Entregas consideradas: {leadTimeValues.length}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Cycle Time por semana de entrega</div>
              <div className="text-[10px] text-[var(--text3)] mt-1">Dias · por semana (fechamento)</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCycleViz("lines")}
                className={`px-2.5 py-1 rounded text-[11px] transition-all ${cycleViz === "lines" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                Linhas
              </button>
              <button
                onClick={() => setCycleViz("scatter")}
                className={`px-2.5 py-1 rounded text-[11px] transition-all ${cycleViz === "scatter" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                Dispersão
              </button>
              {cycleViz === "lines" && (
                <>
                  <button
                    onClick={() => setCycleMode("pct")}
                    className={`px-2.5 py-1 rounded text-[11px] transition-all ${cycleMode === "pct" ? "bg-[rgba(139,92,246,.12)] border border-[var(--purple)] text-[var(--purple)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--purple)] hover:text-[var(--purple)]"}`}
                  >
                    Percentis
                  </button>
                  <button
                    onClick={() => setCycleMode("summary")}
                    className={`px-2.5 py-1 rounded text-[11px] transition-all ${cycleMode === "summary" ? "bg-[rgba(139,92,246,.12)] border border-[var(--purple)] text-[var(--purple)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--purple)] hover:text-[var(--purple)]"}`}
                  >
                    Mín/Méd/Máx
                  </button>
                </>
              )}
              <HelpButton
                isOpen={Boolean(helpOpen.cycle)}
                onClick={() => setHelpOpen((v) => ({ ...v, cycle: !v.cycle }))}
              />
            </div>
          </div>
          {helpOpen.cycle && (
            <div className="text-[12px] text-[var(--text2)] mb-4 leading-relaxed">
              Este gráfico agrupa as demandas pela semana em que foram entregues (data de fechamento) e mostra o Cycle Time em dias.
              <br />
              <br />
              <span className="font-semibold">Cycle Time</span> = tempo em que a demanda ficou em execução (do primeiro status de trabalho ativo até a conclusão). Em geral, exclui a espera inicial em backlog.
              <br />
              <br />
              <span className="font-semibold">Modo Linhas</span>:
              <br />
              - <span className="font-semibold">Percentis</span> (P50/P85/P95): mostra a distribuição. Ex: P85 = 85% das entregas saem em até X dias.
              <br />
              - <span className="font-semibold">Mín/Méd/Máx</span>: mostra mínimo, média e máximo em cada semana.
              <br />
              <br />
              <span className="font-semibold">Modo Dispersão</span>:
              <br />
              Mostra apenas a <span className="font-semibold">linha de tendência</span> (regressão linear) baseada na média semanal; nesse modo, o seletor de percentis fica oculto.
              <br />
              <br />
              O card lateral muda conforme o modo: em percentis ele funciona como um <span className="font-semibold">SLE</span>; nos demais modos ele mostra resumo (média/mín/máx) do período.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 items-stretch">
            <div>
              {hasCycleDeliveries ? (
                cycleViz === "scatter" ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={cycleTrendData as any}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={customTooltip as any} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                      <Line type="monotone" dataKey="Tendencia" name="Tendência" stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={cycleByDeliveryWeekData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                      <Tooltip content={customTooltip as any} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                      {cycleMode === "pct" ? (
                        <>
                          <Line type="monotone" dataKey="P50" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="P85" stroke="var(--purple)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="P95" stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls />
                        </>
                      ) : (
                        <>
                          <Line type="monotone" dataKey="Min" name="Mínimo" stroke="var(--purple)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="Media" name="Média" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                          <Line type="monotone" dataKey="Max" name="Máximo" stroke="var(--warn)" strokeWidth={2} dot={false} connectNulls />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                )
              ) : (
                <EmptyChart title="Cycle Time" />
              )}
            </div>
            {cycleViz === "lines" && cycleMode === "pct" ? (
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
            ) : (
              <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
                <div className="text-[11px] text-[var(--text3)] mb-2">Resumo do período</div>
                <div className="text-[12px] text-[var(--text2)]">Média</div>
                <div className="text-2xl font-bold font-mono leading-none">
                  {cycleSummary.avg != null ? `${cycleSummary.avg.toFixed(1)}d` : "—"}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-[var(--text3)]">Mínimo</div>
                    <div className="text-[13px] font-mono font-semibold">{cycleSummary.min != null ? `${Math.round(cycleSummary.min)}d` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--text3)]">Máximo</div>
                    <div className="text-[13px] font-mono font-semibold">{cycleSummary.max != null ? `${Math.round(cycleSummary.max)}d` : "—"}</div>
                  </div>
                </div>
                <div className="mt-auto pt-3 text-[10px] text-[var(--text3)] font-mono">
                  Entregas consideradas: {cycleTimeValues.length}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {avgDaysByStatus.rows.length > 0 && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mt-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="text-sm font-semibold">Visão geral — média de dias por status</div>
            <div className="text-[10px] text-[var(--text2)] font-mono">PBIs considerados: {workItems.length}</div>
          </div>
          <div>
            {avgDaysByStatus.rows.map((r: { state: string; avgDays: number; items: number }) => (
              <FlowBar
                key={r.state}
                label={`${r.state} (${r.items})`}
                value={r.avgDays}
                max={avgDaysByStatus.max}
                color={STATUS_COLORS[r.state] ?? "#6b7280"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ClockIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2"/></svg>;
const ZapIcon    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const ChartIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
const TargetIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z"/></svg>;
const CheckIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>;
const GridIcon   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>;
const BugIcon    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M8 8h8M9 11h6M10 14h4"/><path d="M9 6a3 3 0 016 0"/><path d="M7 7l-2-2M17 7l2-2M6 12H3M21 12h-3M6 18H4M20 18h-2"/><path d="M8 18c0 1.5 1.8 3 4 3s4-1.5 4-3V11c0-2.2-1.8-4-4-4s-4 1.8-4 4v7z"/></svg>;
const DefectIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 5-3 9-7 10C8 21 5 17 5 12V6l7-4z"/><path d="M9 12l2 2 4-4"/></svg>;
// pink
declare module "react" { interface CSSProperties { ["--pink"]?: string } }
