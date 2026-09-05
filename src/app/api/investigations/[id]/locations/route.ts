import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [locations, events, entities, evidence, tasks, transactions] = await Promise.all([
    db.location.findMany({
      where: { investigationId: id },
      include: {
        events: {
          orderBy: { occurredAt: "asc" },
          include: {
            entity: { select: { id: true, label: true, type: true } },
            evidenceLinks: {
              include: {
                evidence: { select: { id: true, title: true, type: true } },
              },
            },
          },
        },
      },
    }),
    db.event.findMany({
      where: { investigationId: id },
      include: {
        entity: { select: { id: true, label: true, type: true } },
        location: { select: { id: true, name: true, latitude: true, longitude: true } },
        evidenceLinks: {
          include: {
            evidence: { select: { id: true, title: true, type: true } },
          },
        },
      },
      orderBy: { occurredAt: "asc" },
    }),
    db.entity.findMany({
      where: { investigationId: id },
      select: { id: true, label: true, type: true, description: true },
    }),
    db.evidenceItem.findMany({
      where: { investigationId: id },
      select: { id: true, title: true, type: true, source: true },
    }),
    db.investigationTask.findMany({
      where: { investigationId: id },
      select: { id: true, title: true, priority: true, status: true },
    }),
    db.transaction.findMany({
      where: { investigationId: id },
      include: {
        sender: { select: { identifier: true } },
        receiver: { select: { identifier: true } },
      },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    locations: locations.map((loc) => ({
      ...loc,
      eventCount: loc.events.length,
      incidents: Array.from(
        new Set(
          loc.events.map((e) => {
            if (e.title.includes("EX-01")) return "EX-01";
            if (e.title.includes("EX-02")) return "EX-02";
            if (e.title.includes("EX-03")) return "EX-03";
            if (e.title.includes("EX-04")) return "EX-04";
            return "GENERAL";
          })
        )
      ),
    })),
    events: events.map((e) => ({
      ...e,
      incident: e.title.includes("EX-01")
        ? "EX-01"
        : e.title.includes("EX-02")
        ? "EX-02"
        : e.title.includes("EX-03")
        ? "EX-03"
        : e.title.includes("EX-04")
        ? "EX-04"
        : "EX-01",
    })),
    entities,
    evidence,
    tasks,
    transactions,
  });
}
