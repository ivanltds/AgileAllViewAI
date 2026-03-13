/**
 * POST /api/sync
 * Body: { teamId: string, pat: string }
 *
 * Uses Server-Sent Events (SSE) to stream progress back to the client
 * while the sync runs. The PAT is used only during this request and
 * never written to disk.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { teamsRepo } from "@/lib/storage/repositories";
import { syncTeam } from "@/lib/services/syncService";

const schema = z.object({
  teamId: z.string().min(1),
  pat:    z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "teamId and pat are required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { teamId, pat } = parsed.data;
  const team = teamsRepo.byId(teamId);
  if (!team) {
    return new Response(JSON.stringify({ error: "Team not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  // Stream progress via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await syncTeam(team, pat, (step, msg, pct) => {
          send({ step, msg, pct });
        });
        send({ step: "done", msg: "Sincronização concluída!", pct: 100, ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ step: "error", msg, pct: 0, ok: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
