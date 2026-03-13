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
  const [session, setSession] = useState<{ name: string } | null>(null);

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
    const clear = () => { patRef.current = null; };
    window.addEventListener("beforeunload", clear);
    return () => window.removeEventListener("beforeunload", clear);
  }, []);

  const loadTeams = useCallback(async () => {
    const res = await fetch("/api/teams");
    if (res.ok) setTeams(await res.json());
  }, []);

  useEffect(() => {
    if (session) loadTeams();
  }, [session, loadTeams]);

  const handleLogin = (name: string, pat: string) => {
    patRef.current = pat;
    setSession({ name });
  };

  const handleLogout = () => {
    patRef.current = null;
    setSession(null);
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

  const selectTeam = (t: TeamDto) => {
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
          onSelect={selectTeam}
          onAdd={handleAddTeam}
          onDelete={handleDeleteTeam}
          onRefresh={loadTeams}
        />
      )}
    </div>
  );
}
