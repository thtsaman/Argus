import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const entityIds = searchParams.get("entityIds")?.split(",").filter(Boolean);

  const events = await db.event.findMany({
    where: {
      investigationId: id,
      ...(entityIds?.length ? { entityId: { in: entityIds } } : {}),
    },
    include: {
      entity: { select: { id: true, label: true, type: true } },
      location: { select: { id: true, name: true, latitude: true, longitude: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  return NextResponse.json({ events });
}
