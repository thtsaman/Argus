import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildGraphData, findPaths } from "@/lib/graph/analysis";
import { connectionPathSchema } from "@/lib/validation/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = connectionPathSchema.safeParse({ ...body, investigationId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [entities, relationships] = await Promise.all([
    db.entity.findMany({ where: { investigationId: id } }),
    db.relationship.findMany({
      where: { investigationId: id, status: { not: "REJECTED" } },
    }),
  ]);

  const graph = buildGraphData(entities, relationships);
  const paths = findPaths(graph, parsed.data.sourceId, parsed.data.targetId);

  return NextResponse.json({ paths });
}
