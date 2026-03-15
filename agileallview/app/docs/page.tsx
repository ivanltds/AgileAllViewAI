import Link from "next/link";
import type React from "react";
import { DOC_SECTIONS, DOC_TITLE, type DocBlock } from "@/lib/docs/content";

export const metadata = {
  title: `Documentação — AgileAllView`,
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(13,17,23,.75)] backdrop-blur">
        <div className="max-w-[1100px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <AzureIcon size={18} />
            <div className="font-display font-bold text-[15px]">AgileAllView</div>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="/api/docs/pdf"
              className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3.5 py-2 text-sm font-semibold hover:border-[var(--border2)] transition-all"
            >
              Baixar PDF
            </a>
            <Link
              href="/dashboard"
              className="bg-[var(--accent)] hover:bg-sky-400 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-px"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <aside className="w-full lg:w-[280px] lg:sticky lg:top-[84px]">
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--text3)] font-mono uppercase tracking-wider">Guia</div>
              <div className="text-base font-display font-bold mt-2 leading-tight">{DOC_TITLE}</div>
              <div className="mt-4 space-y-1.5">
                {DOC_SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-sm text-[var(--text2)] hover:text-[var(--text)] transition-colors"
                  >
                    {s.title}
                  </a>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <a
                  href="/api/docs/pdf"
                  className="block text-center bg-[rgba(14,165,233,.1)] border border-[rgba(14,165,233,.3)] text-[var(--accent)] rounded-lg px-3.5 py-2 text-sm font-semibold hover:border-[var(--accent)] transition-all"
                >
                  Baixar PDF
                </a>
              </div>
            </div>
          </aside>

          <article className="flex-1 min-w-0">
            <section className="mb-10">
              <h1 className="text-2xl font-display font-bold mb-3">{DOC_TITLE}</h1>
              <p className="text-[13px] text-[var(--text2)] leading-relaxed">
                Esta documentação explica os pré-requisitos mínimos do Azure Boards, como interpretar os gráficos e quais campos impactam cada
                visão. Os exemplos abaixo simulam o visual da aplicação para facilitar a leitura.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <ExampleCard
                  eyebrow="Campos"
                  title="O que precisa estar consistente no Azure Boards"
                  description="Os gráficos refletem seu fluxo real. State, BoardColumn e ClosedDate precisam estar alinhados ao processo. Effort é opcional, mas habilita leituras por esforço."
                >
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Work Item Type" value="PBI / User Story / Defect" />
                    <MiniStat label="Estado" value="New → Doing → Done" />
                    <MiniStat label="BoardColumn" value="To Do / In Progress / Done" />
                    <MiniStat label="ClosedDate" value="define entrega" />
                  </div>
                </ExampleCard>

                <ExampleCard
                  eyebrow="Conceitos"
                  title="Lead Time vs Cycle Time (em dias)"
                  description="Lead Time mede do início ao fim (inclui espera). Cycle Time mede o tempo em execução. Use percentis para SLE e a tendência para ver melhoria/piora ao longo do tempo."
                >
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat label="P85" value="12d" accent="var(--purple)" />
                    <MiniStat label="Média" value="9.4d" accent="var(--accent)" />
                    <MiniStat label="Máx" value="31d" accent="var(--warn)" />
                  </div>
                  <div className="mt-4 bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3">
                    <MiniLineChart />
                    <div className="mt-2 text-[11px] text-[var(--text3)]">
                      Exemplo visual: linhas (percentis) e/ou resumo (mín/méd/máx). O modo “Dispersão” mostra apenas a tendência.
                    </div>
                  </div>
                </ExampleCard>

                <ExampleCard
                  eyebrow="Sprint"
                  title="Planejado vs Realizado (com Extras)"
                  description="Planejado é o snapshot do início do sprint. Realizado considera o que foi concluído dentro do sprint. Extras são itens adicionados após o início e concluídos no mesmo sprint."
                >
                  <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3">
                    <MiniBarStack />
                    <div className="mt-2 text-[11px] text-[var(--text3)]">
                      Exemplo visual: barras empilhadas para Concluído + Extras, e uma barra de Planejado.
                    </div>
                  </div>
                </ExampleCard>

                <ExampleCard
                  eyebrow="Qualidade"
                  title="Bugs e Defeitos — distribuição por severidade/prioridade/estado"
                  description="A visão de Qualidade separa Bugs e Defeitos. Use a distribuição para priorizar triagem e atacar causas-raiz (ex: severidade alta em um estado parado)."
                >
                  <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3">
                    <MiniDonutRow />
                    <div className="mt-2 text-[11px] text-[var(--text3)]">
                      Exemplo visual: pizzas por Severidade/Prioridade/Estado.
                    </div>
                  </div>
                </ExampleCard>
              </div>
            </section>

            {DOC_SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="mb-10">
                <h1 className="text-xl font-display font-bold mb-3">{s.title}</h1>
                <div className="space-y-3">
                  {s.blocks.map((b, i) => (
                    <Block key={i} block={b} />
                  ))}
                </div>
              </section>
            ))}

            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-2xl p-6">
              <div className="text-sm font-semibold">Pronto para usar?</div>
              <div className="text-[12px] text-[var(--text2)] mt-1.5 leading-relaxed">
                Clique em Login, informe a organização e um PAT com permissões de leitura, e depois cadastre seus times.
              </div>
              <div className="mt-4 flex gap-3">
                <Link
                  href="/dashboard"
                  className="bg-[var(--accent)] hover:bg-sky-400 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-px"
                >
                  Ir para Login
                </Link>
                <a
                  href="/api/docs/pdf"
                  className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-4 py-2 text-sm font-semibold hover:border-[var(--border2)] transition-all"
                >
                  Baixar PDF
                </a>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6 py-8 text-[11px] text-[var(--text3)] flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex items-center gap-2">
            <AzureIcon size={14} />
            AgileAllView · Documentação
          </div>
          <div className="font-mono">© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}

function Block({ block }: { block: DocBlock }) {
  if (block.type === "p") {
    return <p className="text-[13px] text-[var(--text2)] leading-relaxed">{block.text}</p>;
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc pl-5 space-y-1.5 text-[13px] text-[var(--text2)]">
        {block.items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="bg-[rgba(245,158,11,.08)] border border-[rgba(245,158,11,.25)] rounded-xl p-4">
      <div className="text-[12px] font-semibold text-amber-500">{block.title}</div>
      <div className="text-[12px] text-[var(--text2)] mt-1 leading-relaxed">{block.text}</div>
    </div>
  );
}

function AzureIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <path d="M33.338 8l-22.01 61.647L46.667 76 64 20.49z" fill="#0089D6"/>
      <path d="M55.404 8L33.338 74.667l51.328-8.358L55.404 8z" fill="#0054A6"/>
      <path d="M11.328 69.647L0 88l46.667-12L11.328 69.647z" fill="#0089D6"/>
    </svg>
  );
}

function ExampleCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-2xl p-5">
      <div className="text-[11px] text-[var(--text3)] font-mono uppercase tracking-wider">{eyebrow}</div>
      <div className="text-sm font-semibold mt-2">{title}</div>
      <div className="text-[12px] text-[var(--text2)] mt-1.5 leading-relaxed">{description}</div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-3">
      <div className="text-[10px] text-[var(--text3)] font-mono">{label}</div>
      <div className="text-[12px] font-semibold mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function MiniLineChart() {
  return (
    <svg viewBox="0 0 360 110" className="w-full h-[90px]">
      <rect x="0" y="0" width="360" height="110" fill="transparent" />
      <path d="M20 92 L80 70 L140 74 L200 58 L260 52 L320 44" stroke="var(--accent)" strokeWidth="3" fill="none" />
      <path d="M20 76 L80 54 L140 58 L200 42 L260 36 L320 30" stroke="var(--purple)" strokeWidth="3" fill="none" opacity="0.8" />
      <path d="M20 56 L80 36 L140 40 L200 30 L260 24 L320 18" stroke="var(--warn)" strokeWidth="3" fill="none" opacity="0.8" />
      <path d="M20 100 L320 18" stroke="var(--text3)" strokeWidth="2" fill="none" opacity="0.35" strokeDasharray="4 5" />
    </svg>
  );
}

function MiniBarStack() {
  return (
    <div className="flex items-end gap-2 h-[90px]">
      <div className="w-8 rounded bg-[var(--text3)]" style={{ height: 62 }} />
      <div className="w-8 rounded overflow-hidden border border-[var(--border)]" style={{ height: 78 }}>
        <div className="w-full bg-[var(--success)]" style={{ height: 56 }} />
        <div className="w-full bg-[var(--warn)]" style={{ height: 22 }} />
      </div>
      <div className="w-8 rounded bg-[var(--text3)]" style={{ height: 52 }} />
      <div className="w-8 rounded overflow-hidden border border-[var(--border)]" style={{ height: 66 }}>
        <div className="w-full bg-[var(--success)]" style={{ height: 48 }} />
        <div className="w-full bg-[var(--warn)]" style={{ height: 18 }} />
      </div>
      <div className="w-8 rounded bg-[var(--text3)]" style={{ height: 44 }} />
      <div className="w-8 rounded overflow-hidden border border-[var(--border)]" style={{ height: 56 }}>
        <div className="w-full bg-[var(--success)]" style={{ height: 44 }} />
        <div className="w-full bg-[var(--warn)]" style={{ height: 12 }} />
      </div>
    </div>
  );
}

function MiniDonutRow() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <MiniDonut label="Severidade" a="var(--danger)" b="var(--warn)" c="var(--success)" />
      <MiniDonut label="Prioridade" a="var(--warn)" b="var(--accent)" c="var(--text3)" />
      <MiniDonut label="Estado" a="var(--accent)" b="var(--purple)" c="var(--success)" />
    </div>
  );
}

function MiniDonut({ label, a, b, c }: { label: string; a: string; b: string; c: string }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="46" height="46" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="16" fill="transparent" stroke="var(--border)" strokeWidth="8" />
        <circle cx="21" cy="21" r="16" fill="transparent" stroke={a} strokeWidth="8" strokeDasharray="42 100" strokeDashoffset="0" />
        <circle cx="21" cy="21" r="16" fill="transparent" stroke={b} strokeWidth="8" strokeDasharray="28 100" strokeDashoffset="-42" />
        <circle cx="21" cy="21" r="16" fill="transparent" stroke={c} strokeWidth="8" strokeDasharray="30 100" strokeDashoffset="-70" />
      </svg>
      <div>
        <div className="text-[10px] text-[var(--text3)] font-mono">{label}</div>
        <div className="text-[12px] text-[var(--text2)]">Exemplo</div>
      </div>
    </div>
  );
}
