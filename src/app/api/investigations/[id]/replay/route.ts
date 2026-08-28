import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [events, relationships, entities] = await Promise.all([
    db.event.findMany({
      where: { investigationId: id },
      orderBy: { occurredAt: "asc" },
      select: { id: true, title: true, occurredAt: true, entityId: true },
    }),
    db.relationship.findMany({
      where: { investigationId: id },
      orderBy: { discoveredAt: "asc" },
      select: { id: true, sourceId: true, targetId: true, status: true, discoveredAt: true },
    }),
    db.entity.findMany({
      where: { investigationId: id },
      select: { id: true, label: true, type: true, createdAt: true },
    }),
  ]);

  const timestamps = new Set<string>();
  events.forEach((e) => timestamps.add(e.occurredAt.toISOString().split("T")[0]));
  relationships.forEach((r) => timestamps.add(r.discoveredAt.toISOString().split("T")[0]));
  entities.forEach((e) => timestamps.add(e.createdAt.toISOString().split("T")[0]));

  const sortedTimestamps = [...timestamps].sort();

  const frames = sortedTimestamps.map((ts) => {
    const date = new Date(ts);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      timestamp: ts,
      events: events.filter((e) => e.occurredAt <= endOfDay),
      relationships: relationships.filter((r) => r.discoveredAt <= endOfDay),
      entities: entities.filter((e) => e.createdAt <= endOfDay),
    };
  });

  return NextResponse.json({ frames });
}
