"use client";
import { useState } from "react";
import type { TeamDto } from "@/lib/types";

export function HomeScreen({ teams, onSelect, onAdd, onDelete, onRefresh }: {
  teams: TeamDto[];
  onSelect: (t: TeamDto) => void;
  onAdd: (data: { name: string; org: string; project: string; teamName: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);

  const syncBadge = (t: TeamDto) => {
    const ss = t.syncState;
    if (!ss?.lastSync) return <span className="text-[10px] bg-[rgba(239,68,68,.08)] border border-[rgba(239,68,68,.25)] text-[var(--danger)] px-2 py-0.5 rounded font-mono">nunca sincronizado</span>;
    const ageH = Math.floor((Date.now() - new Date(ss.lastSync).getTime()) / 3_600_000);
    const label = ageH < 1 ? "agora" : ageH < 48 ? `${ageH}h atrás` : `${Math.floor(ageH / 24)}d atrás`;
    const cls = ageH < 2
      ? "bg-[rgba(34,197,94,.07)] border-[rgba(34,197,94,.25)] text-[var(--success)]"
      : "bg-[rgba(245,158,11,.07)] border-[rgba(245,158,11,.25)] text-[var(--warn)]";
    return <span className={`text-[10px] border px-2 py-0.5 rounded font-mono ${cls}`}>{ageH < 2 ? "✓ " : ""}{label}</span>;
  };

  return (
    <main className="flex-1 px-6 py-7 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-bold font-display">Times cadastrados</h1>
          <p className="text-sm text-[var(--text2)] mt-1">
            {teams.length} squad{teams.length !== 1 ? "s" : ""} · visibilidade unificada
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-[var(--accent)] hover:bg-sky-400 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-all hover:-translate-y-px">
          <PlusIcon />Novo time
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-20 text-[var(--text3)]">
          <div className="text-5xl mb-4">🏗️</div>
          <div className="text-base font-semibold mb-2">Nenhum time cadastrado</div>
          <div className="text-sm">Clique em &quot;Novo time&quot; para começar</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {teams.map((t) => (
            <div key={t.id}
              onClick={() => onSelect(t)}
              className="relative bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_8px_30px_rgba(0,0,0,.35)] card-gradient-border overflow-hidden group">
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-base font-bold">{t.name}</div>
                  <div className="text-[11px] text-[var(--accent)] font-mono mt-0.5">{t.org}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                  className="p-1.5 text-[var(--text3)] hover:text-[var(--danger)] hover:bg-[rgba(239,68,68,.08)] rounded transition-all">
                  <TrashIcon />
                </button>
              </div>

              <div className="text-xs text-[var(--text2)] mb-4">📁 {t.project}</div>

              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {[
                  { label: "Lead Time", val: t.kpis?.avgLeadTime != null ? `${t.kpis.avgLeadTime.toFixed(1)}d` : "—", color: "var(--accent)" },
                  { label: "Conclusão", val: t.kpis?.completionRate != null ? `${t.kpis.completionRate}%` : "—", color: "var(--success)" },
                  { label: "Throughput", val: t.kpis?.throughput ?? "—", color: "var(--warn)" },
                  { label: "PBIs", val: t.kpis?.totalPbis ?? "—", color: "var(--purple)" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-[var(--bg3)] rounded-lg px-3 py-2.5">
                    <div className="text-lg font-bold font-mono leading-none" style={{ color }}>{val}</div>
                    <div className="text-[9px] text-[var(--text3)] uppercase tracking-wide mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                {syncBadge(t)}
                <span className="text-xs text-[var(--accent)]">Abrir →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddTeamModal onClose={() => setShowAdd(false)} onAdd={async (d) => { await onAdd(d); setShowAdd(false); await onRefresh(); }} />}
    </main>
  );
}

function AddTeamModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (d: { name: string; org: string; project: string; teamName: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", org: "", project: "", teamName: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name && form.org && form.project && form.teamName;

  const fields = [
    { key: "name",     label: "Nome do time",                      placeholder: "Ex: Squad Pegasus" },
    { key: "org",      label: "Organização Azure DevOps",          placeholder: "Ex: XerticaBR" },
    { key: "project",  label: "Projeto",                           placeholder: "Ex: Plataforma Core" },
    { key: "teamName", label: "Nome exato do time no Azure DevOps", placeholder: "Ex: Squad Pegasus Team" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-7 w-[460px] max-w-[95vw]">
        <div className="flex items-center justify-between mb-6">
          <div className="text-lg font-bold font-display">Cadastrar novo time</div>
          <button onClick={onClose} className="p-1.5 text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--bg3)] rounded transition-all"><XIcon /></button>
        </div>
        {fields.map(({ key, label, placeholder }) => (
          <div key={key} className="mb-4">
            <label className="block text-xs font-semibold text-[var(--text2)] mb-1.5 uppercase tracking-wide">{label}</label>
            <input value={(form as Record<string,string>)[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder}
              className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] transition-all text-[var(--text)]" />
          </div>
        ))}
        <div className="text-xs text-[var(--text3)] bg-[var(--bg3)] rounded-lg p-3 leading-relaxed mb-5">
          O campo <strong className="text-[var(--text2)]">Nome exato do time</strong> deve ser idêntico ao que aparece no Azure DevOps.
          A Organização é a parte da URL: dev.azure.com/<strong className="text-[var(--text2)]">organização</strong>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-lg px-4 py-2 text-sm hover:border-[var(--border2)] transition-all">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onAdd(form); }}
            disabled={!valid || saving}
            className="bg-[var(--accent)] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {saving ? "Salvando..." : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PlusIcon  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>;
const TrashIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const XIcon     = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>;
