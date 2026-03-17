import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { futureCollaboratorsRepo, teamsRepo } from "@/lib/storage/repositories";

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  teamId: z.string().min(1),
  iterationId: z.string().min(1),
  name: z.string().min(1),
  hoursPerDay: z.number().min(0),
  stacks: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { teamId, iterationId, name, hoursPerDay, stacks } = parsed.data;
  const team = teamsRepo.byId(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const id = parsed.data.id ?? `future_${Date.now()}`;
  futureCollaboratorsRepo.upsert({
    id,
    team_id: teamId,
    iteration_id: iterationId,
    name,
    hours_per_day: hoursPerDay,
    stacks: stacks ? JSON.stringify(stacks) : null,
  });

  return NextResponse.json({ ok: true, id });
}

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = deleteSchema.safeParse({ id: url.searchParams.get("id") });
  if (!parsed.success) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  futureCollaboratorsRepo.delete(parsed.data.id);
  return NextResponse.json({ ok: true });
}
