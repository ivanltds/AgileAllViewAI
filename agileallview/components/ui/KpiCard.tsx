"use client";
export function KpiCard({ label, value, color = "var(--accent)", icon, bg }: {
  label: string; value: string | number;
  color?: string; icon?: React.ReactNode; bg?: string;
}) {
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg p-4">
      {icon && (
        <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
          style={{ background: bg ?? color + "20", color }}>
          {icon}
        </div>
      )}
      <div className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[var(--text3)] uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
