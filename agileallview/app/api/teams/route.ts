/**
 * GET  /api/teams  → list all teams with sync state + KPIs
 * POST /api/teams  → register new team
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teamsRepo, syncStateRepo, workItemsRepo, metricsRepo, iterationsRepo, workItemChildrenRepo } from "@/lib/storage/repositories";

export async function GET() {
  const teams = teamsRepo.all();
  const result = teams.map((t) => {
    const ss = syncStateRepo.get(t.id);
    const pbis = workItemsRepo.byTeam(t.id);
    const done = pbis.filter((p) => p.state === "Done");
    const metrics = metricsRepo.byTeam(t.id);
    const leads = metrics.map((m) => m.lead_time).filter((v): v is number => v != null);
    const cycles = metrics.map((m) => m.cycle_time).filter((v): v is number => v != null);
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const sprints = iterationsRepo.byTeam(t.id).slice(-2);
    const recentNames = new Set(sprints.map((s) => s.name));
    const recentDone = done.filter((p) => p.iteration_name && recentNames.has(p.iteration_name));
    const recentPlanned = pbis.filter((p) => p.iteration_name && recentNames.has(p.iteration_name));

    return {
      id: t.id,
      name: t.name,
      org: t.org,
      project: t.project,
      teamName: t.team_name,
      syncState: ss ? { lastSync: ss.last_sync, itemCount: ss.item_count, status: ss.status } : null,
      kpis: {
        avgLeadTime:    avg(leads),
        avgCycleTime:   avg(cycles),
        throughput:     recentDone.length,
        completionRate: recentPlanned.length
          ? Math.round((recentDone.length / recentPlanned.length) * 100)
          : 0,
        totalPbis: pbis.length,
        openBugs: workItemChildrenRepo.countOpenBugs(t.id),
        openDefects: workItemsRepo.countOpenDefectsIncludingChildren(t.id),
      },
    };
  });
  return NextResponse.json(result);
}

const createSchema = z.object({
  name:     z.string().min(1),
  org:      z.string().min(1),
  project:  z.string().min(1),
  teamName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const id = `team_${Date.now()}`;
  const team = { id, name: parsed.data.name, org: parsed.data.org, project: parsed.data.project, team_name: parsed.data.teamName };
  teamsRepo.upsert(team);
  return NextResponse.json({ ok: true, team });
}
