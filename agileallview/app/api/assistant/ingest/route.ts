import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teamsRepo } from "@/lib/storage/repositories";
import { ensureBaseKnowledge, ingestDocument } from "@/lib/assistant/rag";

export const runtime = "nodejs";

const bodySchema = z.object({
  teamId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();
  const parsed = bodySchema.safeParse({ teamId: form.get("teamId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const teamId = parsed.data.teamId;
  const team = teamsRepo.byId(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await ensureBaseKnowledge(teamId);

  const files = form.getAll("files");
  const ingested: { filename: string; docId: string; chunks: number }[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;
    const text = await f.text();
    if (!text.trim()) continue;
    const r = await ingestDocument({ teamId, filename: f.name, content: text });
    ingested.push({ filename: f.name, ...r });
  }

  return NextResponse.json({ ok: true, ingested });
}
