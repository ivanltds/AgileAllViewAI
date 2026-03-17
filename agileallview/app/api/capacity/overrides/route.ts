import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { capacityOverridesRepo, teamsRepo } from "@/lib/storage/repositories";

const upsertSchema = z.object({
  teamId: z.string().min(1),
  iterationId: z.string().min(1),
  memberId: z.string().min(1),
  overrideHoursPerDay: z.number().nullable(),
  stacks: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { teamId, iterationId, memberId, overrideHoursPerDay, stacks } = parsed.data;
  const team = teamsRepo.byId(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  capacityOverridesRepo.upsert({
    team_id: teamId,
    iteration_id: iterationId,
    member_id: memberId,
    override_hours_per_day: overrideHoursPerDay,
    stacks: stacks ? JSON.stringify(stacks) : null,
    is_dirty: 1,
  });

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({
  teamId: z.string().min(1),
  iterationId: z.string().min(1),
  memberId: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const body = {
    teamId: url.searchParams.get("teamId"),
    iterationId: url.searchParams.get("iterationId"),
    memberId: url.searchParams.get("memberId"),
  };

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "teamId, iterationId and memberId are required" }, { status: 400 });
  }

  const team = teamsRepo.byId(parsed.data.teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  capacityOverridesRepo.delete(parsed.data.teamId, parsed.data.iterationId, parsed.data.memberId);
  return NextResponse.json({ ok: true });
}
