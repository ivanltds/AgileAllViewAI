"use client";
import { useState, useRef, useEffect } from "react";
import type { TeamDto } from "@/lib/types";

export function Topbar({ teams, currentTeam, session, onSelectTeam, onGoHome, onLogout }: {
  teams: TeamDto[];
  currentTeam: TeamDto | null;
  session: { name: string };
  onSelectTeam: (t: TeamDto) => void;
  onGoHome: () => void;
  onLogout: () => void;
}) {
  const byOrg = teams.reduce<Record<string, TeamDto[]>>((acc, t) => {
    (acc[t.org] = acc[t.org] || []).push(t);
    return acc;
  }, {});

  return (
    <header className="h-[52px] bg-[var(--bg2)] border-b border-[var(--border)] flex items-center gap-3 px-5 sticky top-0 z-50">
      {/* Brand */}
      <button onClick={onGoHome} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
        <AzureIcon size={18} />
        <span className="text-[15px] font-bold font-display">AgileAllView</span>
      </button>

      <div className="w-px h-5 bg-[var(--border)]" />

      {/* Team dropdown */}
      <TeamDropdown teams={teams} byOrg={byOrg} current={currentTeam} onSelect={onSelectTeam} />

      {currentTeam && (
        <button onClick={onGoHome}
          className="flex items-center gap-1.5 bg-[var(--bg3)] border border-[var(--border)] rounded-md px-3 py-1.5 text-xs text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--border2)] transition-all">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Times
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text2)]">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--purple)] flex items-center justify-center text-white text-[10px] font-bold">
            {session.name.slice(0, 2).toUpperCase()}
          </div>
          {session.name}
        </div>
        <button onClick={onLogout}
          className="border border-[var(--border)] rounded-md p-1.5 text-[var(--text2)] hover:text-[var(--danger)] hover:border-[rgba(239,68,68,.4)] hover:bg-[rgba(239,68,68,.06)] transition-all"
          title="Encerrar sessão">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

function TeamDropdown({ teams, byOrg, current, onSelect }: {
  teams: TeamDto[]; byOrg: Record<string, TeamDto[]>;
  current: TeamDto | null; onSelect: (t: TeamDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-all min-w-[180px]">
        <TeamIcon />
        <span className="flex-1 text-left">{current?.name ?? "Selecionar time"}</span>
        <span className="text-[9px] opacity-50">▼</span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 bg-[var(--bg2)] border border-[var(--border)] rounded-xl min-w-[240px] z-[200] shadow-[0_12px_40px_rgba(0,0,0,.5)] overflow-hidden">
          {teams.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[var(--text3)]">Nenhum time cadastrado</div>
          ) : (
            Object.entries(byOrg).map(([org, ts]) => (
              <div key={org}>
                <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wider">{org}</div>
                {ts.map((t) => (
                  <button key={t.id} onClick={() => { onSelect(t); setOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--bg3)] ${current?.id === t.id ? "text-[var(--accent)] bg-[rgba(14,165,233,.06)]" : ""}`}>
                    <TeamIcon size={12} />
                    <div>
                      <div className="text-xs font-semibold">{t.name}</div>
                      <div className="text-[10px] text-[var(--text3)]">{t.project}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TeamIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 7a4 4 0 100-8 4 4 0 000 8z"/>
    </svg>
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
