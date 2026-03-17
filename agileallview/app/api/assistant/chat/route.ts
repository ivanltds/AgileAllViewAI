import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teamsRepo, workItemsRepo, iterationsRepo, capacityRepo, capacityOverridesRepo, futureCollaboratorsRepo, assistantMessagesRepo } from "@/lib/storage/repositories";
import { createChatCompletion } from "@/lib/assistant/openai";
import { ensureBaseKnowledge, retrieveRelevantChunks } from "@/lib/assistant/rag";

export const runtime = "nodejs";

const reqSchema = z.object({
  teamId: z.string().min(1),
  message: z.string().min(1),
  iterationId: z.string().min(1).optional(),
});

type UiBlock =
  | { type: "cards"; title?: string; items: { title: string; value: string; subtitle?: string }[] }
  | { type: "list"; title?: string; items: { label: string; value?: string }[] }
  | { type: "text"; title?: string; text: string };

function makeDefaultBlocks(teamName: string, message: string): UiBlock[] {
  return [
    { type: "cards", title: `Assistente — ${teamName}`, items: [{ title: "Pergunta", value: message }] },
  ];
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = reqSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { teamId, message, iterationId } = parsed.data;
  const team = teamsRepo.byId(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await ensureBaseKnowledge(teamId);

  const iterations = iterationsRepo.byTeam(teamId);
  const current = iterations.find((i) => i.time_frame === "current") ?? null;
  const selectedIterationId = iterationId ?? current?.id ?? null;

  const workItems = workItemsRepo.byTeam(teamId);
  const openBugs = workItems.filter((w) => (w.work_item_type === "Bug" || w.work_item_type === "Defect") && (w.state ?? "") !== "Done" && (w.state ?? "") !== "Removed");
  const openPbis = workItems.filter((w) => (w.work_item_type ?? "Product Backlog Item") === "Product Backlog Item" && (w.state ?? "") !== "Done" && (w.state ?? "") !== "Removed");

  const capRows = selectedIterationId ? capacityRepo.byIteration(teamId, selectedIterationId) : [];
  const overrides = selectedIterationId ? capacityOverridesRepo.byIteration(teamId, selectedIterationId) : [];
  const futures = selectedIterationId ? futureCollaboratorsRepo.byIteration(teamId, selectedIterationId) : [];

  const relevant = await retrieveRelevantChunks({ teamId, query: message, topK: 6 });

  const teamSnapshot = {
    team: { id: team.id, name: team.name, org: team.org, project: team.project },
    selectedIterationId,
    currentSprintName: current?.name ?? null,
    counts: {
      pbisOpen: openPbis.length,
      bugsOpen: openBugs.length,
      capacityPeople: capRows.length,
      manualOverrides: overrides.filter((o) => o.is_dirty).length,
      futures: futures.length,
    },
  };

  assistantMessagesRepo.insert({ id: `msg_${Date.now()}_u`, team_id: teamId, role: "user", content: message });

  const system = `Você é um assistente de agilidade dentro do AgileAllView.
Sempre que possível, responda como JSON com o formato: { blocks: UiBlock[], summaryText?: string }.
Nunca responda apenas com texto; inclua ao menos um bloco visual (cards/list).
Não mencione tecnologia, frameworks ou classes. Foque em comportamento e insights de agilidade.
Tipos de bloco permitidos:
- cards: {type:'cards', title?, items:[{title,value,subtitle?}]}
- list: {type:'list', title?, items:[{label,value?}]}
- text: {type:'text', title?, text}
`;

  const userContext = `Contexto do time (JSON):\n${JSON.stringify(teamSnapshot, null, 2)}\n\nTrechos relevantes do conhecimento (RAG):\n${relevant.map((r) => `Score ${r.score.toFixed(3)}\n${r.text}`).join("\n\n---\n\n")}`;

  const assistantRaw = await createChatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContext },
      { role: "user", content: message },
    ],
  });

  const parsedUi = safeJsonParse<{ blocks?: UiBlock[]; summaryText?: string }>(assistantRaw);
  const blocks = parsedUi?.blocks?.length ? parsedUi.blocks : makeDefaultBlocks(team.name, message);
  const summaryText = parsedUi?.summaryText ?? "";

  assistantMessagesRepo.insert({ id: `msg_${Date.now()}_a`, team_id: teamId, role: "assistant", content: assistantRaw });

  return NextResponse.json({ ok: true, blocks, summaryText, raw: assistantRaw });
}
