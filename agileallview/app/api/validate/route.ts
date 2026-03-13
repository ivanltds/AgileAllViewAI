/**
 * POST /api/validate
 * Body: { org: string, pat: string }
 * Returns: { valid: boolean, projects: { id, name }[] }
 *
 * The PAT is NEVER stored — it is only used for this single request.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AzureConnector } from "@/lib/azure/connector";

const schema = z.object({
  org: z.string().min(1),
  pat: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "org and pat are required" }, { status: 400 });
  }

  const { org, pat } = parsed.data;
  try {
    const api = new AzureConnector(pat);
    const projects = await api.getProjects(org);
    return NextResponse.json({ valid: true, projects });
  } catch (err) {
    if (err instanceof Error && err.message === "PAT_INVALID") {
      return NextResponse.json({ valid: false, error: "Token inválido ou sem permissão" }, { status: 401 });
    }
    return NextResponse.json({ valid: false, error: String(err) }, { status: 500 });
  }
}
