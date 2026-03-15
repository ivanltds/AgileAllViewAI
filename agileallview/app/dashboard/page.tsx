"use client";
/**
 * app/dashboard/page.tsx
 * Main client-side shell.
 * Handles session (PAT in memory), team selection, and routing
 * between Home and Dashboard views.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { SessionScreen } from "@/components/dashboard/SessionScreen";
import { HomeScreen }    from "@/components/dashboard/HomeScreen";
import { Topbar }        from "@/components/dashboard/Topbar";
import { Dashboard }     from "@/components/dashboard/Dashboard";
import type { TeamDto } from "@/lib/types";

export default function DashboardPage() {
  // ── Session (PAT never persisted) ────────────────────────────────
  const patRef = useRef<string | null>(null);
  const patsByOrgRef = useRef<Record<string, string>>({});
  const pendingOrgResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [session, setSession] = useState<{ name: string; org: string } | null>(null);
  const [activeOrg, setActiveOrg] = useState<string>("");
  const [expandedOrg, setExpandedOrg] = useState<string>("");
  const [orgPrompt, setOrgPrompt] = useState<{ org: string } | null>(null);
  const [orgPat, setOrgPat] = useState<string>("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string>("");

  // ── Teams ─────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [currentTeam, setCurrentTeam] = useState<TeamDto | null>(null);
  const [periodPreset, setPeriodPreset] = useState<string>("sprints");
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [tab, setTab] = useState<string>("overview");

  // Clear PAT on tab close
  useEffect(() => {
    const clear = () => {
      patRef.current = null;
      patsByOrgRef.current = {};
    };
    window.addEventListener("beforeunload", clear);
    return () => window.removeEventListener("beforeunload", clear);
  }, []);

  const ensureOrgToken = useCallback(async (org: string) => {
    const token = patsByOrgRef.current[org];
    if (token) {
      patRef.current = token;
      setActiveOrg(org);
      setExpandedOrg(org);
      setOrgError("");
      return true;
    }

    if (pendingOrgResolveRef.current) return false;

    setOrgPat("");
    setOrgError("");
    setOrgPrompt({ org });

    const ok = await new Promise<boolean>((resolve) => {
      pendingOrgResolveRef.current = resolve;
    });

    pendingOrgResolveRef.current = null;
    return ok;
  }, []);

  const submitOrgPat = useCallback(async () => {
    if (!orgPrompt?.org || !orgPat.trim()) return;
    setOrgLoading(true);
    setOrgError("");
    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org: orgPrompt.org, pat: orgPat.trim() }),
      });
      const data = await res.json();
      if (!data.valid) {
        setOrgError(data.error ?? "Token inválido");
        return;
      }

      patsByOrgRef.current[orgPrompt.org] = orgPat.trim();
      patRef.current = orgPat.trim();
      setActiveOrg(orgPrompt.org);
      setExpandedOrg(orgPrompt.org);
      setOrgPrompt(null);
      setOrgPat("");
      pendingOrgResolveRef.current?.(true);
    } catch (e) {
      setOrgError(e instanceof Error ? e.message : String(e));
    } finally {
      setOrgLoading(false);
    }
  }, [orgPrompt, orgPat]);

  const cancelOrgPat = useCallback(() => {
    setOrgPrompt(null);
    setOrgPat("");
    setOrgError("");
    pendingOrgResolveRef.current?.(false);
    pendingOrgResolveRef.current = null;
  }, []);

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) setTeams(await res.json());
  }, []);

  useEffect(() => {
    if (session) loadTeams();
  }, [session, loadTeams]);

  const handleLogin = (name: string, org: string, pat: string) => {
    patsByOrgRef.current[org] = pat;
    patRef.current = pat;
    setSession({ name, org });
    setActiveOrg(org);
    setExpandedOrg(org);
  };

  const handleLogout = () => {
    patRef.current = null;
    patsByOrgRef.current = {};
    setSession(null);
    setActiveOrg("");
    setExpandedOrg("");
    setCurrentTeam(null);
    setTeams([]);
  };

  const handleAddTeam = async (data: { name: string; org: string; project: string; teamName: string }) => {
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) await loadTeams();
  };

  const handleDeleteTeam = async (id: string) => {
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    setTeams((ts) => ts.filter((t) => t.id !== id));
    if (currentTeam?.id === id) setCurrentTeam(null);
  };

  const selectTeam = async (t: TeamDto) => {
    const ok = await ensureOrgToken(t.org);
    if (!ok) return;
    setCurrentTeam(t);
    setTab("overview");
  };

  if (!session) {
    return <SessionScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Topbar
        teams={teams}
        currentTeam={currentTeam}
        session={session}
        onSelectTeam={selectTeam}
        onGoHome={() => setCurrentTeam(null)}
        onLogout={handleLogout}
      />

      {currentTeam ? (
        <Dashboard
          key={currentTeam.id}
          team={currentTeam}
          allTeams={teams}
          pat={patRef}
          periodPreset={periodPreset}
          onPeriodPreset={setPeriodPreset}
          selectedSprintIds={selectedSprintIds}
          onSelectedSprintIds={setSelectedSprintIds}
          dateFrom={dateFrom}
          onDateFrom={setDateFrom}
          dateTo={dateTo}
          onDateTo={setDateTo}
          tab={tab}
          onTab={setTab}
          onSyncDone={loadTeams}
        />
      ) : (
        <HomeScreen
          teams={teams}
          activeOrg={activeOrg}
          expandedOrg={expandedOrg}
          onToggleOrg={async (org) => {
            if (org === expandedOrg) return;
            const ok = await ensureOrgToken(org);
            if (!ok) return;
            setExpandedOrg(org);
          }}
          onSelect={selectTeam}
          onAdd={handleAddTeam}
          onDelete={handleDeleteTeam}
          onRefresh={loadTeams}
        />
      )}

      {orgPrompt && (
        <div
          className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && !orgLoading && cancelOrgPat()}
        >
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-7 w-[520px] max-w-[95vw]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-bold font-display">Token da organização</div>
              <button
                onClick={() => !orgLoading && cancelOrgPat()}
                className="p-1.5 text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--bg3)] rounded transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="text-sm text-[var(--text2)] mb-4">
              Informe o PAT para acessar os times de <strong className="text-[var(--text)]">{orgPrompt.org}</strong>.
            </div>

            {orgError && (
              <div className="bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] rounded-lg px-4 py-3 text-sm text-[var(--danger)] mb-4">
                {orgError}
              </div>
            )}

            <label className="block text-xs font-semibold text-[var(--text2)] mb-2 uppercase tracking-wide">Personal Access Token (PAT)</label>
            <input
              type="password"
              value={orgPat}
              onChange={(e) => setOrgPat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitOrgPat()}
              placeholder="••••••••••••••"
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-all font-mono mb-5"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => !orgLoading && cancelOrgPat()}
                className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-4 py-2 text-sm hover:border-[var(--border2)] transition-all disabled:opacity-40"
                disabled={orgLoading}
              >
                Cancelar
              </button>
              <button
                onClick={submitOrgPat}
                disabled={!orgPat.trim() || orgLoading}
                className="bg-[var(--accent)] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {orgLoading ? "Validando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
