import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  const { id, entityId } = await params;

  const entity = await db.entity.findFirst({
    where: { id: entityId, investigationId: id },
    include: { aliases: true },
  });

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const relationships = await db.relationship.findMany({
    where: {
      investigationId: id,
      OR: [{ sourceId: entityId }, { targetId: entityId }],
    },
    include: {
      source: { select: { id: true, label: true } },
      target: { select: { id: true, label: true } },
      evidence: {
        include: { evidence: { select: { title: true } } },
        take: 3,
      },
    },
  });

  return NextResponse.json({ entity, relationships });
}
