import { NextRequest, NextResponse } from "next/server";
import { teamsRepo } from "@/lib/storage/repositories";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  teamsRepo.delete(params.id);
  return NextResponse.json({ ok: true });
}
