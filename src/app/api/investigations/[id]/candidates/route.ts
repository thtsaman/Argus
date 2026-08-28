import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const candidates = await db.candidateFinding.findMany({
    where: { investigationId: id, status: "PENDING" },
    include: { evidence: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ candidates });
}
