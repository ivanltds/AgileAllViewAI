"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StackTag, TeamDto } from "@/lib/types";

const STACKS: StackTag[] = [
  "Backend",
  "Frontend",
  "Data Scientist",
  "QA",
  "Infra / Dev Ops",
  "Design (UX/UI)",
];

type MemberCap = {
  memberId: string;
  memberName: string;
  activities: { name: string; capacityPerDay: number }[];
  workingDays: number;
  dayOffCount: number;
  totalCapacity: number;
  realCapacity: number;
};

type CapacityOverride = {
  team_id: string;
  iteration_id: string;
  member_id: string;
  override_hours_per_day: number | null;
  stacks: string | null;
  is_dirty: number;
};

type FutureCollaborator = {
  id: string;
  team_id: string;
  iteration_id: string;
  name: string;
  hours_per_day: number;
  stacks: string | null;
};

type Sprint = { id: string; name: string; time_frame: string; start_date?: string | null; finish_date?: string | null };

type TeamCapPayload = {
  team: { id: string; name: string };
  availableSprints: Sprint[];
  currentSprint: Sprint | null;
  memberCapacities: MemberCap[];
  capacityOverrides: CapacityOverride[];
  futureCollaborators: FutureCollaborator[];
  _debug?: {
    iterationIdParam?: string | null;
    selectedSprintId?: string | null;
    selectedSprintName?: string | null;
    selectedSprintTimeFrame?: string | null;
    capacityRowCount?: number;
    memberCapacitiesCount?: number;
    capacityOverridesCount?: number;
    futureCollaboratorsCount?: number;
  };
};

type PersonRow = {
  key: string;
  memberId: string;
  name: string;
  azureHoursPerDay: number;
  overrideHoursPerDay: number | null;
  isDirty: boolean;
  stacks: StackTag[];
  teams: { id: string; name: string }[];
  isFuture?: boolean;
  futureId?: string;
};

type Draft = {
  overrideHoursPerDay: number | null;
  stacks: StackTag[];
};

function sumAzureHoursPerDay(m: MemberCap): number {
  return (m.activities ?? []).reduce((s, a) => s + (a.capacityPerDay ?? 0), 0);
}

function parseStacks(raw: string | null | undefined): StackTag[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s) => typeof s === "string") as StackTag[];
  } catch {
    return [];
  }
}

function formatSprintLabel(s: Sprint): string {
  const tf = s.time_frame === "current" ? "atual" : s.time_frame === "future" ? "futura" : "passada";
  return `${s.name} (${tf})`;
}

export function CapacitySimulationTab({ data, allTeams, teamId }: { data: Record<string, unknown> | null; allTeams: TeamDto[]; teamId: string }) {
  const availableSprints = (data?.availableSprints as Sprint[]) ?? [];
  const defaultSprint = (data?.currentSprint as Sprint | null) ?? null;
  const [iterationId, setIterationId] = useState<string>(defaultSprint?.id ?? "");

  useEffect(() => {
    if (!iterationId && defaultSprint?.id) setIterationId(defaultSprint.id);
  }, [iterationId, defaultSprint?.id]);

  const [teamCaps, setTeamCaps] = useState<Record<string, TeamCapPayload | null>>(() => {
    // Seed current team with already-loaded payload (avoids empty view if refetch fails)
    return data ? ({ [teamId]: data as unknown as TeamCapPayload } as Record<string, TeamCapPayload | null>) : {};
  });
  const [loadingTeams, setLoadingTeams] = useState<Record<string, boolean>>({});

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadTeam = async (tid: string) => {
    if (loadingTeams[tid]) return;
    setLoadingTeams((v) => ({ ...v, [tid]: true }));
    try {
      const qs = iterationId ? `?iterationId=${encodeURIComponent(iterationId)}` : "";
      const res = await fetch(`/api/metrics/${tid}${qs}`);
      if (!res.ok) {
        setTeamCaps((v) => ({ ...v, [tid]: null }));
        return;
      }
      const json = (await res.json()) as TeamCapPayload;
      setTeamCaps((v) => ({ ...v, [tid]: json }));
    } catch {
      setTeamCaps((v) => ({ ...v, [tid]: null }));
    } finally {
      setLoadingTeams((v) => ({ ...v, [tid]: false }));
    }
  };

  useEffect(() => {
    if (!iterationId) return;
    for (const t of allTeams) {
      loadTeam(t.id);
    }
  }, [iterationId]);

  useEffect(() => {
    // Clear drafts on sprint switch
    setDrafts({});
  }, [iterationId]);

  const persons = useMemo(() => {
    const byPerson = new Map<string, PersonRow>();

    for (const t of allTeams) {
      const payload = teamCaps[t.id];
      if (!payload) continue;

      const overridesByMember = new Map<string, CapacityOverride>();
      for (const ov of payload.capacityOverrides ?? []) overridesByMember.set(ov.member_id, ov);

      for (const m of payload.memberCapacities ?? []) {
        const ov = overridesByMember.get(m.memberId);
        const stacks = parseStacks(ov?.stacks);
        const rowKey = m.memberId;

        const existing = byPerson.get(rowKey);
        const azure = sumAzureHoursPerDay(m);
        const override = ov?.override_hours_per_day ?? null;

        const next: PersonRow = existing ?? {
          key: rowKey,
          memberId: m.memberId,
          name: m.memberName,
          azureHoursPerDay: azure,
          overrideHoursPerDay: override,
          isDirty: Boolean(ov?.is_dirty),
          stacks,
          teams: [],
        };

        next.name = next.name || m.memberName;
        next.azureHoursPerDay = azure;
        if (override != null) next.overrideHoursPerDay = override;
        if (ov) next.isDirty = Boolean(ov.is_dirty);
        if (stacks.length) next.stacks = stacks;

        next.teams = [...next.teams, { id: t.id, name: t.name }]
          .filter((x, idx, arr) => arr.findIndex((z) => z.id === x.id) === idx);

        byPerson.set(rowKey, next);
      }

      for (const f of payload.futureCollaborators ?? []) {
        const stacks = parseStacks(f.stacks);
        const rowKey = `future::${f.id}`;
        const existing = byPerson.get(rowKey);
        const next: PersonRow = existing ?? {
          key: rowKey,
          memberId: rowKey,
          name: f.name,
          azureHoursPerDay: 0,
          overrideHoursPerDay: f.hours_per_day,
          isDirty: true,
          stacks,
          teams: [],
          isFuture: true,
          futureId: f.id,
        };

        next.name = f.name;
        next.overrideHoursPerDay = f.hours_per_day;
        next.stacks = stacks;
        next.isDirty = true;
        next.teams = [...next.teams, { id: t.id, name: t.name }]
          .filter((x, idx, arr) => arr.findIndex((z) => z.id === x.id) === idx);

        byPerson.set(rowKey, next);
      }
    }

    return Array.from(byPerson.values());
  }, [teamCaps, allTeams]);

  const weeklyByPerson = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of persons) {
      const daily = p.overrideHoursPerDay != null ? p.overrideHoursPerDay : p.azureHoursPerDay;
      map.set(p.key, daily * 5);
    }
    return map;
  }, [persons]);

  const multiTeamByMemberId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of persons) {
      if (p.isFuture) continue;
      map.set(p.memberId, p.teams.length);
    }
    return map;
  }, [persons]);

  const weeklyTotalByMemberId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of persons) {
      if (p.isFuture) continue;
      const cur = map.get(p.memberId) ?? 0;
      map.set(p.memberId, cur + (weeklyByPerson.get(p.key) ?? 0));
    }
    return map;
  }, [persons, weeklyByPerson]);

  const teamRows = useMemo(() => {
    const byTeam = new Map<string, PersonRow[]>();
    for (const t of allTeams) byTeam.set(t.id, []);

    for (const p of persons) {
      for (const t of p.teams) {
        const arr = byTeam.get(t.id) ?? [];
        arr.push(p);
        byTeam.set(t.id, arr);
      }
    }

    for (const [tid, arr] of Array.from(byTeam.entries())) {
      arr.sort((a: PersonRow, b: PersonRow) => a.name.localeCompare(b.name));
      byTeam.set(tid, arr);
    }

    return byTeam;
  }, [persons, allTeams]);

  const selectedTeamPayload = teamCaps[teamId] ?? null;
  const selectedTeamRows = teamRows.get(teamId) ?? [];

  const kpis = useMemo(() => {
    const totalWeekly = selectedTeamRows.reduce((s, p) => s + (weeklyByPerson.get(p.key) ?? 0), 0);
    const dirtyCount = selectedTeamRows.filter((p) => p.isDirty).length;

    const byStack: Record<string, number> = {};
    for (const p of selectedTeamRows) {
      const hrs = weeklyByPerson.get(p.key) ?? 0;
      const stacks = p.stacks.length ? p.stacks : ["Backend"];
      const share = hrs / stacks.length;
      for (const st of stacks) byStack[st] = (byStack[st] ?? 0) + share;
    }

    const overAllocated = selectedTeamRows.filter((p) => {
      if (p.isFuture) return false;
      return (weeklyTotalByMemberId.get(p.memberId) ?? 0) > 40;
    });

    const impactsOtherTeams = overAllocated
      .filter((p) => p.teams.some((t) => t.id !== teamId))
      .map((p) => ({
        key: p.key,
        name: p.name,
        totalWeekly: weeklyTotalByMemberId.get(p.memberId) ?? 0,
        otherTeams: p.teams.filter((t) => t.id !== teamId).map((t) => t.name),
      }));

    return { totalWeekly, dirtyCount, byStack, overAllocated, impactsOtherTeams };
  }, [selectedTeamRows, weeklyByPerson, weeklyTotalByMemberId]);

  const saveOverride = async (teamIdArg: string, memberId: string, hoursPerDay: number | null, stacks: StackTag[]) => {
    await fetch("/api/capacity/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: teamIdArg,
        iterationId,
        memberId,
        overrideHoursPerDay: hoursPerDay,
        stacks,
      }),
    });
    await loadTeam(teamIdArg);
  };

  const scheduleSaveOverride = (teamIdArg: string, memberId: string, draft: Draft) => {
    const key = `${teamIdArg}::${iterationId}::${memberId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      void saveOverride(teamIdArg, memberId, draft.overrideHoursPerDay, draft.stacks);
    }, 600);
  };

  const saveFuture = async (teamIdArg: string, future: { id?: string; name: string; hoursPerDay: number; stacks: StackTag[] }) => {
    await fetch("/api/capacity/future", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: future.id,
        teamId: teamIdArg,
        iterationId,
        name: future.name,
        hoursPerDay: future.hoursPerDay,
        stacks: future.stacks,
      }),
    });
    await loadTeam(teamIdArg);
  };

  const deleteFuture = async (id: string, teamIdArg: string) => {
    await fetch(`/api/capacity/future?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadTeam(teamIdArg);
  };

  const toggleStack = (teamIdArg: string, person: PersonRow, stack: StackTag) => {
    if (person.isFuture) return;
    const dkey = `${teamIdArg}::${person.memberId}`;
    const current = drafts[dkey] ?? { overrideHoursPerDay: person.overrideHoursPerDay, stacks: person.stacks };
    const nextStacks = current.stacks.includes(stack)
      ? current.stacks.filter((s) => s !== stack)
      : [...current.stacks, stack];
    const next = { ...current, stacks: nextStacks };
    setDrafts((v) => ({ ...v, [dkey]: next }));
    scheduleSaveOverride(teamIdArg, person.memberId, next);
  };

  const Row = ({ team, p }: { team: { id: string; name: string }; p: PersonRow }) => {
    const weekly = weeklyByPerson.get(p.key) ?? 0;
    const multiTeam = !p.isFuture && (multiTeamByMemberId.get(p.memberId) ?? 0) > 1;
    const totalWeekly = !p.isFuture ? (weeklyTotalByMemberId.get(p.memberId) ?? 0) : weekly;
    const over40 = totalWeekly > 40;

    const dkey = `${team.id}::${p.memberId}`;
    const draft = !p.isFuture ? drafts[dkey] : undefined;
    const shownOverride = draft ? draft.overrideHoursPerDay : p.overrideHoursPerDay;
    const shownStacks = draft ? draft.stacks : p.stacks;

    const dirtyClass = p.isDirty
      ? "border border-[rgba(245,158,11,.35)] bg-[rgba(245,158,11,.06)]"
      : "border border-[var(--border)] bg-[var(--bg3)]";

    return (
      <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-2 ${dirtyClass}`}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--purple)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate flex items-center gap-2">
            <span className="truncate">{p.name}</span>
            {multiTeam && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(139,92,246,.12)] text-[var(--purple)]">multi-time</span>}
            {p.isFuture && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(14,165,233,.12)] text-[var(--accent)]">futuro</span>}
            {p.isDirty && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(245,158,11,.15)] text-[var(--warn)]">manual</span>}
            {over40 && <span className="text-[10px] px-2 py-0.5 rounded-full border-2 border-[rgba(239,68,68,1)] text-[var(--danger)]">+40h</span>}
          </div>
          <div className="text-[10px] text-[var(--text3)] mt-0.5">
            {shownStacks.length ? shownStacks.join(", ") : "(sem stack)"}
            {over40 && !p.isFuture ? ` · total cross-times: ${totalWeekly.toFixed(0)}h/sem` : ""}
          </div>
          {!p.isFuture && (
            <div className="mt-2 flex flex-wrap gap-1">
              {STACKS.map((s) => {
                const on = shownStacks.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStack(team.id, p, s)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${on ? "bg-[rgba(14,165,233,.12)] border-[rgba(14,165,233,.35)] text-[var(--accent)]" : "bg-[var(--bg2)] border-[var(--border)] text-[var(--text3)]"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-[var(--text3)]">Azure</div>
            <div className="text-xs font-mono text-[var(--text2)]">{p.azureHoursPerDay.toFixed(1)}h/d</div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-[var(--text3)]">Manual</div>
            <input
              type="number"
              step={0.5}
              min={0}
              value={shownOverride ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const n = v === "" ? null : Number(v);
                if (p.isFuture) return;
                const next: Draft = { overrideHoursPerDay: n, stacks: shownStacks };
                setDrafts((d) => ({ ...d, [dkey]: next }));
                scheduleSaveOverride(team.id, p.memberId, next);
              }}
              disabled={p.isFuture}
              className="w-[88px] bg-[var(--bg2)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
            />
          </div>

          <div className="text-right">
            <div className="text-[10px] text-[var(--text3)]">Sem</div>
            <div className="text-xs font-mono text-[var(--accent)]">{weekly.toFixed(0)}h</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold">Capacidade & Simulação</div>
          <div className="text-xs text-[var(--text3)]">Sprint selecionada define capacity (Azure) e overrides (manual)</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-[var(--text3)]">Sprint</div>
          <select
            value={iterationId}
            onChange={(e) => setIterationId(e.target.value)}
            className="bg-[var(--bg2)] border border-[var(--border)] rounded px-2 py-1 text-xs"
          >
            {availableSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSprintLabel(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-start">
        <div>
          {allTeams.map((t) => {
            const rows = teamRows.get(t.id) ?? [];
            const loading = Boolean(loadingTeams[t.id]);
            const payload = teamCaps[t.id];
            const dbg = payload?._debug;
            return (
              <div key={t.id} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-[10px] text-[var(--text3)]">
                    {loading ? "carregando…" : `${rows.length} pessoas`}
                  </div>
                </div>
                {t.id === teamId && (
                  <div className="flex justify-end mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        void saveFuture(t.id, { name: "Colaborador", hoursPerDay: 7, stacks: [] });
                      }}
                      className="text-xs text-[var(--text2)] hover:text-[var(--text)] bg-[var(--bg3)] border border-[var(--border)] rounded px-2.5 py-1"
                    >
                      Adicionar futuro
                    </button>
                  </div>
                )}
                {payload == null && !loading ? (
                  <p className="text-xs text-[var(--danger)]">Erro ao carregar dados (verifique o console / sincronização)</p>
                ) : rows.length === 0 ? (
                  <div className="text-xs text-[var(--text3)]">
                    <div>Sem capacity registrada nesta sprint</div>
                    {dbg && (
                      <div className="mt-2 text-[10px] text-[var(--text3)] font-mono">
                        <div>debug.selectedSprintId: {String(dbg.selectedSprintId ?? "—")}</div>
                        <div>debug.capacityRowCount: {String(dbg.capacityRowCount ?? "—")}</div>
                        <div>debug.memberCapacitiesCount: {String(dbg.memberCapacitiesCount ?? "—")}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {rows.map((p) => (
                      <div key={`${t.id}::${p.key}`}>
                        <Row team={t} p={p} />
                        {p.isFuture && p.futureId && t.id === teamId && (
                          <div className="flex justify-end -mt-1 mb-2">
                            <button
                              type="button"
                              onClick={() => void deleteFuture(p.futureId as string, t.id)}
                              className="text-[10px] text-[var(--text3)] hover:text-[var(--text)]"
                            >
                              remover futuro
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky top-[68px]">
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mb-4">
            <div className="text-sm font-semibold mb-3">KPIs — {allTeams.find((t) => t.id === teamId)?.name ?? "Time"}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg3)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--text3)]">Capacidade total (h/sem)</div>
                <div className="text-2xl font-bold font-mono text-[var(--accent)]">{kpis.totalWeekly.toFixed(0)}h</div>
              </div>
              <div className="bg-[var(--bg3)] rounded-lg p-3">
                <div className="text-[10px] text-[var(--text3)]">Itens manuais</div>
                <div className="text-2xl font-bold font-mono text-[var(--warn)]">{kpis.dirtyCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mb-4">
            <div className="text-sm font-semibold mb-3">Capacidade por stack (h/sem)</div>
            {Object.keys(kpis.byStack).length === 0 ? (
              <p className="text-xs text-[var(--text3)]">Sem stacks definidas</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(kpis.byStack)
                  .sort((a, b) => b[1] - a[1])
                  .map(([st, hrs]) => (
                    <div key={st} className="flex justify-between text-xs">
                      <span className="text-[var(--text2)]">{st}</span>
                      <span className="font-mono text-[var(--accent)]">{hrs.toFixed(0)}h</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
            <div className="text-sm font-semibold mb-3">Riscos</div>
            {kpis.overAllocated.length === 0 ? (
              <p className="text-xs text-[var(--success)]">Nenhuma pessoa acima de 40h/sem (cross-times)</p>
            ) : (
              <div className="space-y-2">
                {kpis.overAllocated.map((p) => (
                  <div key={p.key} className="bg-[rgba(239,68,68,.06)] border border-[rgba(239,68,68,.25)] rounded-lg p-3">
                    <div className="text-xs font-semibold text-[var(--danger)]">{p.name}</div>
                    <div className="text-[10px] text-[var(--text3)] mt-0.5">
                      total: {(weeklyTotalByMemberId.get(p.memberId) ?? 0).toFixed(0)}h/sem · em {p.teams.length} times
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mt-4">
            <div className="text-sm font-semibold mb-3">Impactos em outros times</div>
            {kpis.impactsOtherTeams.length === 0 ? (
              <p className="text-xs text-[var(--text3)]">Sem impactos cross-team para esta sprint</p>
            ) : (
              <div className="space-y-2">
                {kpis.impactsOtherTeams.map((i) => (
                  <div key={i.key} className="bg-[rgba(139,92,246,.06)] border border-[rgba(139,92,246,.2)] rounded-lg p-3">
                    <div className="text-xs font-semibold">{i.name}</div>
                    <div className="text-[10px] text-[var(--text3)] mt-0.5">
                      {i.totalWeekly.toFixed(0)}h/sem · outros times: {i.otherTeams.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTeamPayload == null && (
            <div className="text-xs text-[var(--text3)] mt-3">Carregando KPIs…</div>
          )}
        </div>
      </div>

      <div className="mt-5 bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <div className="text-sm font-semibold mb-3">Stacks disponíveis</div>
        <div className="flex flex-wrap gap-2">
          {STACKS.map((s) => (
            <span key={s} className="text-xs bg-[var(--bg3)] border border-[var(--border)] rounded-full px-3 py-1 text-[var(--text2)]">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
