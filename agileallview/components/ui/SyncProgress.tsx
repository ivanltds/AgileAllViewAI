"use client";
export function SyncProgress({ msg, pct }: { msg: string; pct: number }) {
  return (
    <div className="bg-[rgba(14,165,233,.06)] border border-[rgba(14,165,233,.2)] rounded-lg p-5">
      <div className="text-sm font-semibold mb-1">Sincronizando dados...</div>
      <div className="text-xs text-[var(--text2)] font-mono mb-3">{msg}</div>
      <div className="bg-[var(--bg3)] rounded h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--accent)] to-sky-400 rounded transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-[var(--accent)] font-mono text-right mt-1">{pct}%</div>
    </div>
  );
}
