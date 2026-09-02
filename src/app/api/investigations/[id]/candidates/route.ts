import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");

  const whereClause: any = { investigationId: id };
  if (statusParam && statusParam !== "ALL") {
    whereClause.status = statusParam;
  }

  const candidates = await db.candidateFinding.findMany({
    where: whereClause,
    include: {
      evidence: { select: { id: true, title: true, fileName: true } },
      entity: { select: { id: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ candidates });
}
