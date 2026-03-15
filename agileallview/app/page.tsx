import Link from "next/link";
import { DemoSection } from "@/components/landing/DemoSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[rgba(13,17,23,.75)] backdrop-blur">
        <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AzureIcon size={18} />
            <div className="font-display font-bold text-[15px]">AgileAllView</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3.5 py-2 text-sm font-semibold hover:border-[var(--border2)] transition-all"
            >
              Documentação
            </Link>
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

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(14,165,233,0.14),transparent)]" />
          <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(var(--bg3) 1px,transparent 1px),linear-gradient(90deg,var(--bg3) 1px,transparent 1px)", backgroundSize: "44px 44px", opacity: 0.18 }} />

          <div className="relative max-w-[1200px] mx-auto px-6 pt-16 pb-14">
            <div className="inline-flex items-center gap-2 text-[11px] px-3 py-1 rounded-full border border-[rgba(14,165,233,.25)] bg-[rgba(14,165,233,.08)] text-[var(--accent)] font-mono">
              Azure DevOps Analytics · Visibilidade unificada
            </div>

            <h1 className="mt-4 text-[38px] leading-[1.05] font-display font-bold tracking-tight max-w-[820px]">
              Tenha clareza do que está acontecendo nos seus times sem abrir 10 boards diferentes.
            </h1>

            <p className="mt-4 text-[15px] text-[var(--text2)] max-w-[820px] leading-relaxed">
              O AgileAllView transforma Azure DevOps Boards em uma leitura executiva e operacional: previsibilidade de sprint, tendência de Lead/Cycle,
              backlog com sinais de risco e painéis de qualidade. Feito para líderes que precisam decidir rápido — e para times que precisam de foco.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 items-start">
              <Link
                href="/dashboard"
                className="bg-[var(--accent)] hover:bg-sky-400 text-white rounded-lg px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(14,165,233,.22)]"
              >
                Entrar e conectar meu Azure DevOps
              </Link>
              <a
                href="#features"
                className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-5 py-3 text-sm font-semibold hover:border-[var(--border2)] transition-all"
              >
                Ver o que eu ganho
              </a>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "1 visão, vários times", desc: "Compare squads e encontre gargalos sem trocar de projeto/board." },
                { title: "Decisões com dados", desc: "Percentis, tendência e indicadores de variação para orientar o que atacar primeiro." },
                { title: "Foco no que importa", desc: "Backlog e sprints com sinais de risco, carry-over e extras (mudança de escopo)." },
              ].map((c) => (
                <div key={c.title} className="relative bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] opacity-80" />
                  <div className="text-sm font-semibold">{c.title}</div>
                  <div className="text-[12px] text-[var(--text2)] mt-2 leading-relaxed">{c.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 items-start">
              <a
                href="#demo"
                className="bg-[rgba(14,165,233,.1)] border border-[rgba(14,165,233,.3)] text-[var(--accent)] rounded-lg px-5 py-3 text-sm font-semibold hover:border-[var(--accent)] transition-all"
              >
                Ver demo com dados fake
              </a>
              <a
                href="/docs"
                className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-5 py-3 text-sm font-semibold hover:border-[var(--border2)] transition-all"
              >
                Ler documentação
              </a>
            </div>
          </div>
        </section>

        <div id="demo">
          <DemoSection />
        </div>

        <section id="features" className="max-w-[1200px] mx-auto px-6 py-14">
          <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
            <div>
              <div className="text-[11px] text-[var(--text3)] font-mono uppercase tracking-wider">O que a ferramenta oferece</div>
              <h2 className="text-2xl font-display font-bold mt-2">Uma leitura clara do seu delivery — sem abrir múltiplas telas</h2>
            </div>
            <Link
              href="/dashboard"
              className="bg-[rgba(14,165,233,.1)] border border-[rgba(14,165,233,.3)] text-[var(--accent)] rounded-lg px-4 py-2 text-sm font-semibold hover:border-[var(--accent)] transition-all"
            >
              Fazer login
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: "📊", title: "Visão Geral", desc: "KPIs e gráficos para entender ritmo de entrega, saúde do fluxo e tendência de desempenho." },
              { icon: "🧾", title: "Backlog / PBIs", desc: "Backlog organizado, com destaque para defeitos e visão rápida do status e do que está bloqueando." },
              { icon: "🏃", title: "Sprints", desc: "Planejado vs Realizado, carry-over, extras e leitura sprint a sprint com foco em previsibilidade." },
              { icon: "🛡️", title: "Qualidade", desc: "Distribuição de severidade, prioridade e estado de Bugs e Defeitos para guiar ações de qualidade." },
              { icon: "🧠", title: "Capacidade", desc: "Capacidade por pessoa e por atividade para antecipar riscos e negociar escopo com dados." },
              { icon: "🧪", title: "Simulação", desc: "Simule cenários de composição do time e estime capacidade semanal/sprint com transparência." },
            ].map((f) => (
              <div key={f.title} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--bg3)] border border-[var(--border)] flex items-center justify-center text-sm">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-[12px] text-[var(--text2)] mt-1.5 leading-relaxed">{f.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[1200px] mx-auto px-6 pb-16">
          <div className="bg-gradient-to-br from-[rgba(14,165,233,.10)] to-[rgba(139,92,246,.10)] border border-[rgba(14,165,233,.25)] rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-[11px] text-[var(--text3)] font-mono uppercase tracking-wider">Comece em 2 minutos</div>
              <div className="text-xl font-display font-bold mt-2">Conecte seu Azure DevOps e comece a enxergar previsibilidade</div>
              <div className="text-[12px] text-[var(--text2)] mt-2 max-w-[780px] leading-relaxed">
                O token é utilizado apenas durante a sessão e serve para consultar o Azure DevOps. Você cadastra seus times e sincroniza quando precisar.
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="bg-[var(--accent)] hover:bg-sky-400 text-white rounded-lg px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-px"
              >
                Login
              </Link>
              <Link
                href="/docs"
                className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-5 py-3 text-sm font-semibold hover:border-[var(--border2)] transition-all"
              >
                Documentação
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 text-[11px] text-[var(--text3)] flex flex-col sm:flex-row gap-2 justify-between">
          <div className="flex items-center gap-2">
            <AzureIcon size={14} />
            AgileAllView · Azure DevOps Analytics
          </div>
          <div className="font-mono">© {new Date().getFullYear()}</div>
        </div>
      </footer>
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
