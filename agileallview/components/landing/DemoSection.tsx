"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type DemoView = "overview" | "sprints" | "quality" | "backlog";

const customTooltip = ({ active, payload, label }: any) => {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs">
      <div className="font-semibold mb-1">{String(label)}</div>
      {(payload as { name: string; value: number; color: string }[]).map((p) => (
        <div key={p.name} className="flex items-center gap-2" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: {typeof p.value === "number" ? p.value.toFixed?.(1) ?? p.value : p.value}
        </div>
      ))}
    </div>
  );
};

export function DemoSection() {
  const [view, setView] = useState<DemoView>("overview");
  const [timeMode, setTimeMode] = useState<"pct" | "summary">("pct");
  const [vizMode, setVizMode] = useState<"lines" | "trend">("lines");
  const [pct, setPct] = useState(85);

  const leadByWeek = useMemo(
    () => [
      { name: "2026-01-06", P50: 6.2, P85: 11.3, P95: 18.8, Media: 8.7, Min: 2.0, Max: 26.0, Tendencia: 9.6 },
      { name: "2026-01-13", P50: 5.7, P85: 10.1, P95: 16.4, Media: 7.9, Min: 1.0, Max: 21.0, Tendencia: 9.0 },
      { name: "2026-01-20", P50: 5.1, P85: 9.0, P95: 14.7, Media: 7.1, Min: 1.0, Max: 17.0, Tendencia: 8.4 },
      { name: "2026-01-27", P50: 4.8, P85: 8.5, P95: 13.8, Media: 6.6, Min: 1.0, Max: 15.0, Tendencia: 7.8 },
      { name: "2026-02-03", P50: 4.3, P85: 7.6, P95: 12.2, Media: 5.9, Min: 1.0, Max: 13.0, Tendencia: 7.2 },
      { name: "2026-02-10", P50: 4.0, P85: 7.2, P95: 11.5, Media: 5.4, Min: 1.0, Max: 12.0, Tendencia: 6.6 },
    ],
    []
  );

  const sprints = useMemo(
    () => [
      { name: "Sprint 21", Planejado: 18, Concluido: 14, Extras: 3 },
      { name: "Sprint 22", Planejado: 20, Concluido: 17, Extras: 2 },
      { name: "Sprint 23", Planejado: 16, Concluido: 15, Extras: 1 },
      { name: "Sprint 24", Planejado: 22, Concluido: 18, Extras: 4 },
    ],
    []
  );

  const severity = useMemo(
    () => [
      { name: "S1", value: 3, color: "var(--danger)" },
      { name: "S2", value: 5, color: "var(--warn)" },
      { name: "S3", value: 9, color: "var(--accent)" },
      { name: "S4", value: 7, color: "var(--success)" },
    ],
    []
  );

  const backlog = useMemo(
    () => [
      { title: "Checkout — ajuste de antifraude", type: "PBI", state: "Doing", risk: "Alto" },
      { title: "Integração CRM — sincronização", type: "User Story", state: "To Do", risk: "Médio" },
      { title: "Defect — cálculo de imposto", type: "Defect", state: "Doing", risk: "Alto" },
      { title: "Carrinho — performance mobile", type: "PBI", state: "Testing", risk: "Médio" },
    ],
    []
  );

  const sleDays = useMemo(() => {
    const values = leadByWeek.flatMap((x) => [x.P50, x.P85, x.P95].filter((n) => typeof n === "number")) as number[];
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
    return sorted[idx] ?? null;
  }, [leadByWeek, pct]);

  return (
    <section className="max-w-[1200px] mx-auto px-6 pb-16">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
        <div>
          <div className="text-[11px] text-[var(--text3)] font-mono uppercase tracking-wider">Demo interativa</div>
          <h2 className="text-2xl font-display font-bold mt-2">Veja os gráficos e interaja com uma análise de time fictício</h2>
          <div className="text-[12px] text-[var(--text2)] mt-2 max-w-[860px] leading-relaxed">
            Esta demonstração usa dados simulados só para você experimentar a leitura: Lead/Cycle com percentis ou resumo, Planejado vs Realizado
            com extras e qualidade por severidade.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ViewBtn active={view === "overview"} onClick={() => setView("overview")}>
            Visão Geral
          </ViewBtn>
          <ViewBtn active={view === "sprints"} onClick={() => setView("sprints")}>
            Sprints
          </ViewBtn>
          <ViewBtn active={view === "quality"} onClick={() => setView("quality")}>
            Qualidade
          </ViewBtn>
          <ViewBtn active={view === "backlog"} onClick={() => setView("backlog")}>
            Backlog
          </ViewBtn>
        </div>
      </div>

      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-2xl p-5">
        {view === "overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-stretch">
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Lead Time por semana de entrega</div>
                  <div className="text-[10px] text-[var(--text3)] mt-1">Dias · exemplo</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setVizMode("lines")}
                    className={`px-2.5 py-1 rounded text-[11px] transition-all ${vizMode === "lines" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg2)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                  >
                    Linhas
                  </button>
                  <button
                    onClick={() => setVizMode("trend")}
                    className={`px-2.5 py-1 rounded text-[11px] transition-all ${vizMode === "trend" ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg2)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
                  >
                    Dispersão
                  </button>
                  {vizMode === "lines" && (
                    <>
                      <button
                        onClick={() => setTimeMode("pct")}
                        className={`px-2.5 py-1 rounded text-[11px] transition-all ${timeMode === "pct" ? "bg-[rgba(139,92,246,.12)] border border-[var(--purple)] text-[var(--purple)]" : "bg-[var(--bg2)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--purple)] hover:text-[var(--purple)]"}`}
                      >
                        Percentis
                      </button>
                      <button
                        onClick={() => setTimeMode("summary")}
                        className={`px-2.5 py-1 rounded text-[11px] transition-all ${timeMode === "summary" ? "bg-[rgba(139,92,246,.12)] border border-[var(--purple)] text-[var(--purple)]" : "bg-[var(--bg2)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--purple)] hover:text-[var(--purple)]"}`}
                      >
                        Mín/Méd/Máx
                      </button>
                    </>
                  )}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={leadByWeek as any}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={customTooltip as any} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                  {vizMode === "trend" ? (
                    <Line type="monotone" dataKey="Tendencia" name="Tendência" stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls />
                  ) : timeMode === "pct" ? (
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

              <div className="mt-3 text-[11px] text-[var(--text3)]">
                Dica de leitura: use <span className="text-[var(--accent)] font-semibold">Percentis</span> para definir um SLE, e o modo
                <span className="text-[var(--accent)] font-semibold"> Dispersão</span> para ver se o tempo está melhorando ou piorando.
              </div>
            </div>

            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 flex flex-col">
              {vizMode === "lines" && timeMode === "pct" ? (
                <>
                  <div className="text-[11px] text-[var(--text3)] mb-2">SLE (percentil)</div>
                  <div className="text-3xl font-bold font-mono leading-none">{sleDays != null ? `${Math.round(sleDays)}d` : "—"}</div>
                  <div className="text-[11px] text-[var(--text2)] mt-2 leading-snug">
                    {pct}% das entregas saem em até {sleDays != null ? `${Math.round(sleDays)} dias` : "—"}
                  </div>
                  <div className="mt-auto pt-3">
                    <input
                      type="range"
                      min={50}
                      max={99}
                      step={1}
                      value={pct}
                      onChange={(e) => setPct(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text3)] mt-1">
                      <span>50%</span>
                      <span>99%</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] text-[var(--text3)] mb-2">Resumo</div>
                  <MiniKpi label="Média (últimas semanas)" value="6.9d" accent="var(--accent)" />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <MiniKpi label="Mínimo" value="1d" accent="var(--purple)" />
                    <MiniKpi label="Máximo" value="26d" accent="var(--warn)" />
                  </div>
                  <div className="mt-auto pt-3 text-[10px] text-[var(--text3)] font-mono">Dados simulados</div>
                </>
              )}
            </div>
          </div>
        )}

        {view === "sprints" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-sm font-semibold mb-3">Planejado vs Realizado (por sprint)</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={sprints as any}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={customTooltip as any} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                  <Bar dataKey="Planejado" fill="var(--text3)" />
                  <Bar dataKey="Concluido" stackId="b" fill="var(--success)" />
                  <Bar dataKey="Extras" stackId="b" fill="var(--warn)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 text-[11px] text-[var(--text3)]">
                Interpretação rápida: extras altos podem indicar mudança de escopo; realizado abaixo do planejado sugere overcommit.
              </div>
            </div>

            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-sm font-semibold mb-3">Resumo do time (fake)</div>
              <div className="grid grid-cols-2 gap-3">
                <MiniKpi label="Previsibilidade" value="Boa" accent="var(--success)" />
                <MiniKpi label="Risco" value="Médio" accent="var(--warn)" />
                <MiniKpi label="Carry-over" value="Baixo" accent="var(--accent)" />
                <MiniKpi label="Mudança de escopo" value="Moderada" accent="var(--purple)" />
              </div>
              <div className="mt-4 text-[12px] text-[var(--text2)] leading-relaxed">
                Se este fosse seu time real, a recomendação seria atacar a variabilidade do escopo (extras) e revisar a qualidade do refinamento.
              </div>
            </div>
          </div>
        )}

        {view === "quality" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-sm font-semibold mb-3">Severidade (Bugs/Defeitos)</div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severity as any} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {severity.map((s) => (
                        <Cell key={s.name} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 text-[11px] text-[var(--text3)]">
                Interpretação rápida: se S1/S2 crescerem, priorize triagem e trate causa-raiz antes de acelerar throughput.
              </div>
            </div>

            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-sm font-semibold mb-3">Checklist de ação</div>
              <div className="space-y-2 text-[12px] text-[var(--text2)] leading-relaxed">
                <div className="flex gap-2">
                  <span className="text-[var(--accent)] font-mono">1</span>
                  <span>Crie uma rotina de triagem (diária/2x semana) e defina SLA por severidade.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--accent)] font-mono">2</span>
                  <span>Separe Bug vs Defect para não misturar incidente técnico com débito de produto.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[var(--accent)] font-mono">3</span>
                  <span>Use estados e colunas consistentes no Azure para o gráfico refletir a realidade.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "backlog" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-sm font-semibold mb-3">Backlog (amostra)</div>
              <div className="space-y-2">
                {backlog.map((x) => (
                  <div key={x.title} className="border border-[var(--border)] bg-[var(--bg2)] rounded-xl px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate">{x.title}</div>
                        <div className="text-[11px] text-[var(--text3)] mt-1 font-mono">
                          {x.type} · {x.state}
                        </div>
                      </div>
                      <div
                        className={`text-[10px] px-2 py-1 rounded border ${
                          x.risk === "Alto"
                            ? "text-red-300 border-[rgba(239,68,68,.35)] bg-[rgba(239,68,68,.08)]"
                            : "text-amber-300 border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.08)]"
                        }`}
                      >
                        Risco {x.risk}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-sm font-semibold mb-3">Leitura rápida</div>
              <div className="grid grid-cols-2 gap-3">
                <MiniKpi label="Itens Doing" value="2" accent="var(--accent)" />
                <MiniKpi label="Defeitos" value="1" accent="var(--danger)" />
                <MiniKpi label="Sinais de risco" value="2" accent="var(--warn)" />
                <MiniKpi label="Próximo foco" value="Triagem" accent="var(--purple)" />
              </div>
              <div className="mt-4 text-[12px] text-[var(--text2)] leading-relaxed">
                Em um cenário real, você clicaria no item para ver filhos (tasks/bugs) e identificar bloqueios, esforço restante e riscos.
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border ${
        active
          ? "bg-[rgba(14,165,233,.12)] border-[rgba(14,165,233,.45)] text-[var(--accent)]"
          : "bg-[var(--bg2)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--border2)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function MiniKpi({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-3">
      <div className="text-[10px] text-[var(--text3)] font-mono">{label}</div>
      <div className="text-[13px] font-semibold mt-1" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
