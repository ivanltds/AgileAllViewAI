"use client";

import { useEffect, useRef, useState } from "react";

type UiBlock =
  | { type: "cards"; title?: string; items: { title: string; value: string; subtitle?: string }[] }
  | { type: "list"; title?: string; items: { label: string; value?: string }[] }
  | { type: "text"; title?: string; text: string };

type ChatMessage = { role: "user" | "assistant"; blocks?: UiBlock[]; text?: string };

export function AssistantWidget({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages.length]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, message: msg }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", blocks: [{ type: "cards", title: "Erro", items: [{ title: "Falha", value: json?.error ? JSON.stringify(json.error) : "Erro" }] }] }]);
        return;
      }

      setMessages((m) => [...m, { role: "assistant", blocks: json.blocks ?? [{ type: "text", text: json.raw ?? "" }] }]);
    } finally {
      setLoading(false);
    }
  };

  const upload = async () => {
    const files = fileRef.current?.files;
    if (!files?.length) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    for (const f of Array.from(files)) fd.append("files", f);

    setLoading(true);
    try {
      const res = await fetch("/api/assistant/ingest", { method: "POST", body: fd });
      const json = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          blocks: [
            {
              type: "cards",
              title: "Upload",
              items: [
                { title: "Status", value: res.ok ? "OK" : "Erro" },
                { title: "Resultado", value: JSON.stringify(json) },
              ],
            },
          ],
        },
      ]);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[200] w-12 h-12 rounded-full bg-[var(--accent)] text-white shadow-[0_12px_40px_rgba(0,0,0,.55)] hover:brightness-110 active:brightness-95 transition"
        title="Assistente IA"
      >
        IA
      </button>

      {open && (
        <div className="fixed inset-0 z-[210]" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="absolute inset-0 bg-black/55" />
          <aside className="absolute top-0 right-0 h-full w-[520px] max-w-[95vw] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col">
            <div className="h-[52px] px-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="text-sm font-semibold">Assistente IA</div>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-[var(--text2)] hover:text-[var(--text)]">Fechar</button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4 text-xs text-[var(--text2)]">
                  Pergunte sobre planejamento, bugs, capacidade e fluxo. Faça upload de documentos para enriquecer o conhecimento.
                </div>
              )}

              {messages.map((m, idx) => (
                <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                  {m.text && (
                    <div className={`inline-block max-w-[90%] rounded-xl px-3 py-2 text-xs border ${m.role === "user" ? "bg-[rgba(14,165,233,.12)] border-[rgba(14,165,233,.25)]" : "bg-[var(--bg2)] border-[var(--border)]"}`}>
                      {m.text}
                    </div>
                  )}
                  {m.blocks?.map((b, bi) => (
                    <Block key={bi} block={b} />
                  ))}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <input ref={fileRef} type="file" multiple className="text-xs" />
                <button
                  type="button"
                  onClick={upload}
                  disabled={loading}
                  className="text-xs bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-1.5 hover:border-[var(--border2)] disabled:opacity-40"
                >
                  Upload
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Pergunte algo..."
                  className="flex-1 bg-[var(--bg2)] border border-[var(--border)] rounded px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="text-xs bg-[var(--accent)] text-white rounded px-3 py-2 disabled:opacity-40"
                >
                  {loading ? "..." : "Enviar"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function Block({ block }: { block: UiBlock }) {
  if (block.type === "text") {
    return (
      <div className="mt-2 bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text2)]">
        {block.title && <div className="text-[10px] uppercase tracking-wider text-[var(--text3)] mb-1">{block.title}</div>}
        <div className="whitespace-pre-wrap">{block.text}</div>
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <div className="mt-2 bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-3 text-xs">
        {block.title && <div className="text-[10px] uppercase tracking-wider text-[var(--text3)] mb-2">{block.title}</div>}
        <div className="space-y-1">
          {block.items.map((it, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3">
              <div className="text-[var(--text2)]">{it.label}</div>
              {it.value && <div className="text-[var(--text3)] font-mono">{it.value}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-3 text-xs">
      {block.title && <div className="text-[10px] uppercase tracking-wider text-[var(--text3)] mb-2">{block.title}</div>}
      <div className="grid grid-cols-2 gap-2">
        {block.items.map((c, idx) => (
          <div key={idx} className="bg-[var(--bg3)] border border-[var(--border)] rounded-lg px-3 py-2">
            <div className="text-[10px] text-[var(--text3)] uppercase tracking-wider">{c.title}</div>
            <div className="text-sm font-semibold font-mono text-[var(--text)] mt-1">{c.value}</div>
            {c.subtitle && <div className="text-[10px] text-[var(--text3)] mt-1">{c.subtitle}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
