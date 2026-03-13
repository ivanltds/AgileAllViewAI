"use client";
export function FlowBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="flex gap-2 mb-2 items-center">
      <div className="w-28 text-[11px] text-[var(--text2)] text-right truncate flex-shrink-0">{label}</div>
      <div className="flex-1 h-6 bg-[var(--bg3)] rounded overflow-hidden">
        <div
          className="h-full rounded flex items-center px-2 text-[10px] font-semibold text-white/90 transition-all duration-500"
          style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 4 : 0 }}
        >
          {pct > 16 ? `${value.toFixed(1)}d` : ""}
        </div>
      </div>
      <div className="w-12 text-right text-[11px] text-[var(--text2)] font-mono flex-shrink-0">
        {value.toFixed(1)}d
      </div>
    </div>
  );
}
