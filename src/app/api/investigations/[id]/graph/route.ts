import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildGraphData } from "@/lib/graph/analysis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [entities, relationships] = await Promise.all([
    db.entity.findMany({ where: { investigationId: id } }),
    db.relationship.findMany({
      where: { investigationId: id, status: { not: "REJECTED" } },
    }),
  ]);

  return NextResponse.json(buildGraphData(entities, relationships));
}
