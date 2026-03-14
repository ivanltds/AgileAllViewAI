"use client";

import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

type PieRow = { name: string; value: number };

type QualityBlock = {
  defects?: { bySeverity?: PieRow[]; byPriority?: PieRow[]; byState?: PieRow[] };
  bugs?: { bySeverity?: PieRow[]; byPriority?: PieRow[]; byState?: PieRow[] };
};

const COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
  "#94a3b8",
];

function fmtName(n: string) {
  const s = (n ?? "").trim();
  return s || "(vazio)";
}

function PieCard({ title, data }: { title: string; data: PieRow[] }) {
  const cleaned = useMemo(() => {
    return (Array.isArray(data) ? data : [])
      .map((d) => ({ name: fmtName(String(d.name)), value: Number(d.value ?? 0) }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0);
  }, [data]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {cleaned.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-[var(--text3)] text-sm">Sem dados</div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={cleaned} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {cleaned.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text2)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function QualityTab({ data }: { data: Record<string, unknown> | null }) {
  const quality = (data as any)?.quality as QualityBlock | undefined;

  const bugs = {
    bySeverity: (quality?.bugs?.bySeverity ?? []) as PieRow[],
    byPriority: (quality?.bugs?.byPriority ?? []) as PieRow[],
    byState: (quality?.bugs?.byState ?? []) as PieRow[],
  };

  const defects = {
    bySeverity: (quality?.defects?.bySeverity ?? []) as PieRow[],
    byPriority: (quality?.defects?.byPriority ?? []) as PieRow[],
    byState: (quality?.defects?.byState ?? []) as PieRow[],
  };

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <div className="text-base font-bold font-display">Qualidade</div>
        <div className="text-xs text-[var(--text2)] mt-1">
          Bugs = itens filhos do tipo <span className="font-mono">Bug</span>. Defeitos = PBIs do tipo <span className="font-mono">Bug</span>.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[var(--text2)] px-1">Bugs</div>
          <PieCard title="Severidade" data={bugs.bySeverity} />
          <PieCard title="Prioridade" data={bugs.byPriority} />
          <PieCard title="Estado" data={bugs.byState} />
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold text-[var(--text2)] px-1">Defeitos</div>
          <PieCard title="Severidade" data={defects.bySeverity} />
          <PieCard title="Prioridade" data={defects.byPriority} />
          <PieCard title="Estado" data={defects.byState} />
        </div>
      </div>
    </div>
  );
}
