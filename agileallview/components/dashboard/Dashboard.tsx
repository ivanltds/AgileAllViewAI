"use client";
import { useState, useEffect, useCallback } from "react";
import { SyncProgress } from "@/components/ui/SyncProgress";
import { OverviewTab }  from "./tabs/OverviewTab";
import { BacklogTab }   from "./tabs/BacklogTab";
import { SprintsTab }   from "./tabs/SprintsTab";
import { CapacityTab }  from "./tabs/CapacityTab";
import { SimulationTab } from "./tabs/SimulationTab";
import { QualityTab } from "./tabs/QualityTab";
import type { TeamDto } from "@/lib/types";

const TABS = [
  { id: "overview",    label: "Visão Geral" },
  { id: "backlog",     label: "Backlog / PBIs" },
  { id: "sprints",     label: "Sprints" },
  { id: "quality",     label: "Qualidade" },
  { id: "capacity",    label: "Capacidade" },
  { id: "simulation",  label: "Simulação" },
];

const FILTER_PRESETS = [
  { label: "3 meses",   value: "3m" },
  { label: "6 meses",   value: "6m" },
  { label: "1 ano",     value: "1y" },
];

export function Dashboard({
  team,
  allTeams,
  pat,
  periodPreset,
  onPeriodPreset,
  selectedSprintIds,
  onSelectedSprintIds,
  dateFrom,
  onDateFrom,
  dateTo,
  onDateTo,
  tab,
  onTab,
  onSyncDone,
}: {
  team: TeamDto;
  allTeams: TeamDto[];
  pat: React.RefObject<string | null>;
  periodPreset: string;
  onPeriodPreset: (p: string) => void;
  selectedSprintIds: string[];
  onSelectedSprintIds: (ids: string[]) => void;
  dateFrom: string;
  onDateFrom: (v: string) => void;
  dateTo: string;
  onDateTo: (v: string) => void;
  tab: string;
  onTab: (t: string) => void;
  onSyncDone: () => Promise<void>;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProg, setSyncProg] = useState<{ msg: string; pct: number } | null>(null);
  const [syncError, setSyncError] = useState("");

  const noFiltersApplied =
    !selectedSprintIds.length &&
    periodPreset === "sprints" &&
    !dateFrom &&
    !dateTo;

  const showPeriodFilters = tab !== "capacity" && tab !== "simulation";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSprintIds.length) {
        params.set("sprintIds", selectedSprintIds.join(","));
      } else if (periodPreset === "3m" || periodPreset === "6m" || periodPreset === "1y") {
        const months = periodPreset === "3m" ? 3 : periodPreset === "6m" ? 6 : 12;
        const now = new Date();
        const from = new Date(now);
        from.setMonth(from.getMonth() - months);
        params.set("from", from.toISOString().slice(0, 10));
        params.set("to", now.toISOString().slice(0, 10));
      } else {
        params.set("sprints", "4");
      }

      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to",   dateTo);

      if (tab === "backlog" && noFiltersApplied) {
        params.set("openBacklog", "1");
      }

      const res = await fetch(`/api/metrics/${team.id}?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [team.id, selectedSprintIds, periodPreset, dateFrom, dateTo, tab, noFiltersApplied]);

  useEffect(() => { loadData(); }, [loadData]);

  const doSync = async () => {
    if (!pat.current) { setSyncError("Token não disponível. Faça login novamente."); return; }
    setSyncing(true); setSyncError(""); setSyncProg({ msg: "Iniciando...", pct: 0 });

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, pat: pat.current }),
      });

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            setSyncProg({ msg: event.msg, pct: event.pct });
            if (event.step === "error") setSyncError(event.msg);
          } catch {}
        }
      }

      await loadData();
      await onSyncDone();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
      setSyncProg(null);
    }
  };

  const sprintMetrics = (data?.sprintMetrics as unknown[]) ?? [];
  const hasSyncState  = team.syncState?.lastSync;
  const availableSprintsRaw = ((data as any)?.availableSprints as any[] | undefined) ?? [];
  const availableSprints = [...availableSprintsRaw].sort((a, b) => {
    const ad = new Date((a as any).start_date ?? (a as any).finish_date ?? 0).getTime();
    const bd = new Date((b as any).start_date ?? (b as any).finish_date ?? 0).getTime();
    return bd - ad;
  });
  const nextFutureId = (() => {
    const fut = availableSprintsRaw
      .filter((s) => String((s as any).time_frame) === "future")
      .slice()
      .sort((a, b) => {
        const ad = new Date((a as any).start_date ?? (a as any).finish_date ?? 0).getTime();
        const bd = new Date((b as any).start_date ?? (b as any).finish_date ?? 0).getTime();
        return ad - bd;
      })[0];
    return fut ? String((fut as any).id) : null;
  })();

  return (
    <main className="flex-1 px-5 py-5 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold font-display">{team.name}</h1>
          <div className="text-xs text-[var(--text2)] font-mono mt-1">
            {team.org} / {team.project} · {team.teamName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {team.syncState?.lastSync && (
            <span className="text-[11px] text-[var(--text3)] font-mono">
              Sync: {new Date(team.syncState.lastSync).toLocaleString("pt-BR")}
            </span>
          )}
          <button onClick={doSync} disabled={syncing}
            className="flex items-center gap-1.5 bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--border2)] rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50">
            <RefreshIcon spinning={syncing} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] rounded-lg px-4 py-3 text-sm text-[var(--danger)] mb-4">{syncError}</div>
      )}
      {syncing && syncProg && <div className="mb-4"><SyncProgress {...syncProg} /></div>}

      {/* First sync nudge */}
      {!hasSyncState && !syncing && (
        <div className="bg-[rgba(14,165,233,.05)] border border-[rgba(14,165,233,.2)] rounded-xl p-5 mb-5 flex items-center gap-4">
          <InfoIcon />
          <div>
            <div className="font-semibold mb-1">Este time ainda não foi sincronizado</div>
            <div className="text-sm text-[var(--text2)]">Clique em &quot;Sincronizar&quot; para buscar os dados do Azure DevOps.</div>
          </div>
          <button onClick={doSync} className="ml-auto flex-shrink-0 bg-[var(--accent)] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-sky-400 transition-all">
            Sincronizar agora
          </button>
        </div>
      )}

      {/* Filters */}
      {showPeriodFilters && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-4 py-3 mb-5 flex flex-wrap gap-3 items-center">
          <FilterIcon />
          <span className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide">Período</span>
          <div className="w-px h-4 bg-[var(--border)]" />
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-[var(--text3)]">Sprints:</span>
            <div className="flex gap-1.5 flex-wrap">
              {availableSprints.map((s) => {
                const id = String((s as any).id);
                const name = String((s as any).name ?? "?");
                const active = selectedSprintIds.includes(id);
                const frame = String((s as any).time_frame ?? "past");
                const isCurrent = frame === "current";
                const isFuture = frame === "future";
                const isNext = isFuture && nextFutureId === id;

                const baseInactive = "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]";
                const currentInactive = "bg-[rgba(14,165,233,.08)] border border-[rgba(14,165,233,.25)] text-[var(--text2)] hover:border-[var(--accent)]";
                const nextInactive = "bg-[rgba(139,92,246,.08)] border border-[rgba(139,92,246,.25)] text-[var(--text2)] hover:border-[var(--purple)]";
                const futureInactive = "bg-[rgba(148,163,184,.06)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--border2)]";
                const inactiveClass = isCurrent
                  ? currentInactive
                  : isNext
                    ? nextInactive
                    : isFuture
                      ? futureInactive
                      : baseInactive;

                return (
                  <button
                    key={id}
                    onClick={() => {
                      onPeriodPreset("sprints");
                      onDateFrom("");
                      onDateTo("");
                      onSelectedSprintIds(active
                        ? selectedSprintIds.filter((x: string) => x !== id)
                        : [...selectedSprintIds, id]
                      );
                    }}
                    className={`px-2.5 py-1 rounded text-xs transition-all ${active ? "bg-[rgba(14,165,233,.12)] border border-[var(--accent)] text-[var(--accent)]" : inactiveClass}`}
                    title={name}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-px h-4 bg-[var(--border)]" />
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  onSelectedSprintIds([]);
                  onPeriodPreset(p.value);
                  onDateFrom("");
                  onDateTo("");
                }}
                className={`px-2.5 py-1 rounded text-xs transition-all ${periodPreset === p.value ? "bg-[rgba(14,165,233,.1)] border border-[var(--accent)] text-[var(--accent)]" : "bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { onSelectedSprintIds([]); onPeriodPreset("sprints"); onDateFrom(""); onDateTo(""); }}
            className="ml-auto px-2.5 py-1 rounded text-xs transition-all bg-[var(--bg3)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Limpar
          </button>
          <div className="w-px h-4 bg-[var(--border)]" />
          <span className="text-[10px] text-[var(--text3)]">De:</span>
          <input type="date" value={dateFrom} onChange={(e) => { onDateFrom(e.target.value); onSelectedSprintIds([]); onPeriodPreset("custom"); }}
            className="bg-[var(--bg3)] border border-[var(--border)] rounded text-xs px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]" />
          <span className="text-[10px] text-[var(--text3)]">Até:</span>
          <input type="date" value={dateTo} onChange={(e) => { onDateTo(e.target.value); onSelectedSprintIds([]); onPeriodPreset("custom"); }}
            className="bg-[var(--bg3)] border border-[var(--border)] rounded text-xs px-2 py-1 text-[var(--text)] outline-none focus:border-[var(--accent)]" />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onTab(t.id);
              if (t.id === "capacity" || t.id === "simulation") {
                onSelectedSprintIds([]);
                onPeriodPreset("sprints");
                onDateFrom("");
                onDateTo("");
              }
            }}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t.id ? "bg-[rgba(14,165,233,.1)] text-[var(--accent)]" : "text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--bg3)]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text3)]">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--bg4)] border-t-[var(--accent)] animate-spin-slow mr-3" />
          Carregando dados...
        </div>
      ) : (
        <div className="animate-fade-up">
          {tab === "overview"   && <OverviewTab   data={data} />}
          {tab === "backlog"    && <BacklogTab    data={data} openBacklog={noFiltersApplied} />}
          {tab === "sprints"    && <SprintsTab    data={data} />}
          {tab === "quality"    && <QualityTab    data={data} />}
          {tab === "capacity"   && <CapacityTab   data={data} />}
          {tab === "simulation" && <SimulationTab data={data} allTeams={allTeams} teamId={team.id} />}
        </div>
      )}
    </main>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-3 h-3 ${spinning ? "animate-spin-slow" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM12 8h.01M12 12v4"/>
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[var(--text3)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
    </svg>
  );
}
