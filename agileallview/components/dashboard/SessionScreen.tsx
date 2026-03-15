"use client";
import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

export function SessionScreen({ onLogin }: { onLogin: (name: string, org: string, pat: string) => void }) {
  const [name,  setName]  = useState("");
  const [pat,   setPat]   = useState("");
  const [org,   setOrg]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!name.trim() || !org.trim() || !pat.trim()) return;
    setLoading(true); setError("");

    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org: org.trim(), pat: pat.trim() }),
    });
    const data = await res.json();
    if (!data.valid) {
      setError(data.error ?? "Token inválido");
      setLoading(false);
      return;
    }

    setLoading(false);
    onLogin(name.trim(), org.trim(), pat.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--bg)]">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.08),transparent)]" />
      <div className="absolute inset-0"
        style={{ backgroundImage: "linear-gradient(var(--bg3) 1px,transparent 1px),linear-gradient(90deg,var(--bg3) 1px,transparent 1px)", backgroundSize: "40px 40px", opacity: 0.2 }} />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <AzureIcon />
          <div>
            <div className="text-xl font-bold font-display tracking-tight">AgileAllView</div>
            <div className="text-[10px] text-[var(--text3)] font-mono mt-0.5">powered by Azure DevOps</div>
          </div>
        </div>

        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
          <h1 className="text-[22px] font-bold font-display mb-1">Iniciar sessão</h1>
          <p className="text-sm text-[var(--text2)] mb-7 leading-relaxed">
            Conecte seu Personal Access Token para acessar os dashboards dos times.
          </p>

          {error && (
            <div className="bg-[rgba(239,68,68,.1)] border border-[rgba(239,68,68,.3)] rounded-lg px-4 py-3 text-sm text-[var(--danger)] mb-5">
              {error}
            </div>
          )}

          {[
            { label: "Nome", value: name, onChange: setName, placeholder: "Seu nome", type: "text" },
            { label: "Organização", value: org, onChange: setOrg, placeholder: "ex: MinhaEmpresa", type: "text" },
            { label: "Personal Access Token (PAT)", value: pat, onChange: setPat, placeholder: "••••••••••••••", type: "password" },
          ].map(({ label, value, onChange, placeholder, type }) => (
            <div key={label} className="mb-5">
              <label className="block text-xs font-semibold text-[var(--text2)] mb-2 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(14,165,233,.1)] transition-all font-mono"
              />
            </div>
          ))}

          <button
            onClick={handleLogin}
            disabled={!name.trim() || !org.trim() || !pat.trim() || loading}
            className="w-full bg-[var(--accent)] hover:bg-sky-400 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(14,165,233,.3)] active:translate-y-0"
          >
            {loading ? <><Spinner size={14} />Validando...</> : "Iniciar sessão"}
          </button>

          <div className="mt-5 flex gap-2 bg-[rgba(245,158,11,.07)] border border-[rgba(245,158,11,.2)] rounded-lg px-3 py-2.5 text-[12px] text-amber-600">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
            </svg>
            Token armazenado apenas em memória de sessão. Removido automaticamente ao fechar a aba.
          </div>
        </div>
      </div>
    </div>
  );
}

function AzureIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 96 96" fill="none">
      <path d="M33.338 8l-22.01 61.647L46.667 76 64 20.49z" fill="#0089D6"/>
      <path d="M55.404 8L33.338 74.667l51.328-8.358L55.404 8z" fill="#0054A6"/>
      <path d="M11.328 69.647L0 88l46.667-12L11.328 69.647z" fill="#0089D6"/>
    </svg>
  );
}
