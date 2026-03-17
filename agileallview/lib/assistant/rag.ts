import { assistantChunksRepo, assistantDocumentsRepo } from "@/lib/storage/repositories";
import { createEmbedding } from "@/lib/assistant/openai";

const BASE_DOC_ID = "base_agility";

const BASE_KNOWLEDGE = `
Lead Time: tempo desde o comprometimento (Committed) até o item estar Done.
Cycle Time: tempo desde In Progress até Done.
Throughput: quantidade de itens concluídos por unidade de tempo (ex.: sprint).
Capacity: capacidade disponível do time (ex.: horas/dia ou horas/semana).
Flow Efficiency: tempo ativo / (tempo ativo + tempo de espera). Indicador de gargalos.
Gargalo: etapa/estado onde itens acumulam e esperam mais tempo.
Boas práticas: limitar WIP, reduzir handoffs, definir políticas de pronto, analisar percentis.
Interpretação: use percentis para variabilidade; média pode esconder caudas longas.
`;

export function chunkText(text: string, maxChars = 900): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paras = normalized.split(/\n\n+/g).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  for (const p of paras) {
    if (!buf) {
      buf = p;
      continue;
    }
    if ((buf + "\n\n" + p).length <= maxChars) {
      buf = buf + "\n\n" + p;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf) chunks.push(buf);

  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function ensureBaseKnowledge(teamId: string) {
  const docs = assistantDocumentsRepo.byTeam(teamId);
  const hasBase = docs.some((d) => d.id === BASE_DOC_ID);
  if (hasBase) return;

  assistantDocumentsRepo.upsert({
    id: BASE_DOC_ID,
    team_id: teamId,
    filename: "base_agility.txt",
    content: BASE_KNOWLEDGE,
  });

  const chunks = chunkText(BASE_KNOWLEDGE);
  const rows = [] as { id: string; team_id: string; document_id: string; chunk_index: number; text: string; embedding: string }[];
  for (let i = 0; i < chunks.length; i++) {
    const emb = await createEmbedding(chunks[i]);
    rows.push({
      id: `${BASE_DOC_ID}::${i}`,
      team_id: teamId,
      document_id: BASE_DOC_ID,
      chunk_index: i,
      text: chunks[i],
      embedding: JSON.stringify(emb),
    });
  }
  assistantChunksRepo.insertMany(rows as any);
}

export async function ingestDocument(params: { teamId: string; filename: string; content: string }) {
  const docId = `doc_${Date.now()}`;
  assistantDocumentsRepo.upsert({ id: docId, team_id: params.teamId, filename: params.filename, content: params.content });

  const chunks = chunkText(params.content);
  const rows = [] as { id: string; team_id: string; document_id: string; chunk_index: number; text: string; embedding: string }[];
  for (let i = 0; i < chunks.length; i++) {
    const emb = await createEmbedding(chunks[i]);
    rows.push({
      id: `${docId}::${i}`,
      team_id: params.teamId,
      document_id: docId,
      chunk_index: i,
      text: chunks[i],
      embedding: JSON.stringify(emb),
    });
  }
  assistantChunksRepo.insertMany(rows as any);

  return { docId, chunks: rows.length };
}

export async function retrieveRelevantChunks(params: { teamId: string; query: string; topK?: number }) {
  const topK = params.topK ?? 6;
  const qEmb = await createEmbedding(params.query);

  const chunks = assistantChunksRepo.byTeam(params.teamId);
  const scored = chunks
    .map((c) => {
      let emb: number[] = [];
      try {
        emb = JSON.parse(c.embedding) as number[];
      } catch {
        emb = [];
      }
      return {
        id: c.id,
        text: c.text,
        score: cosineSimilarity(qEmb, emb),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
