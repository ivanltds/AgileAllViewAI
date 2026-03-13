import { NextRequest, NextResponse } from "next/server";
import { workItemChildrenRepo } from "@/lib/storage/repositories";

export async function GET(req: NextRequest, { params }: { params: { teamId: string } }) {
  const url = new URL(req.url);
  const parentIdsParam = url.searchParams.get("parentIds") ?? "";
  const parentIds = parentIdsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!parentIds.length) {
    return NextResponse.json({ children: {}, sums: {} });
  }

  const rows = workItemChildrenRepo.byParents(parentIds);
  const children: Record<string, { id: number; type: string | null; title: string | null; state: string | null; assignedTo: string | null; remainingWork: number | null }[]> = {};
  const sums: Record<string, number> = {};

  for (const r of rows) {
    const key = String(r.parent_id);
    const arr = children[key] ?? [];
    arr.push({ id: r.child_id, type: r.child_type ?? null, title: r.title ?? null, state: r.state ?? null, assignedTo: r.assigned_to ?? null, remainingWork: r.remaining_work ?? null });
    children[key] = arr;

    const rw = r.remaining_work ?? 0;
    sums[key] = (sums[key] ?? 0) + (Number.isFinite(rw) ? rw : 0);
  }

  return NextResponse.json({ children, sums });
}
