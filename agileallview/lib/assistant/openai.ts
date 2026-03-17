export type OpenAIEmbeddingResponse = {
  data: { embedding: number[] }[];
};

export type OpenAIChatResponse = {
  choices: { message: { role: string; content: string } }[];
};

export async function createEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OPENAI_EMBEDDING_FAILED: ${res.status} ${t}`);
  }

  const json = (await res.json()) as OpenAIEmbeddingResponse;
  const emb = json.data?.[0]?.embedding;
  if (!emb?.length) throw new Error("OPENAI_EMBEDDING_EMPTY");
  return emb;
}

export async function createChatCompletion(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OPENAI_CHAT_FAILED: ${res.status} ${t}`);
  }

  const json = (await res.json()) as OpenAIChatResponse;
  return json.choices?.[0]?.message?.content ?? "";
}
