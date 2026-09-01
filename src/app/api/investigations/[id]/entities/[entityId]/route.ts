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

  // Fetch investigation context counts
  const [investigationCount, eventsCount, locationsCount, relationshipEvidenceCount] = await Promise.all([
    db.entity.count({
      where: { label: entity.label },
    }),
    db.event.count({
      where: { investigationId: id, entities: { some: { entityId } } },
    }),
    db.location.count({
      where: { investigationId: id, entityId },
    }),
    db.evidenceOnRelationship.count({
      where: { relationship: { OR: [{ sourceId: entityId }, { targetId: entityId }], investigationId: id } },
    }),
  ]);

  const relationships = await db.relationship.findMany({
    where: {
      investigationId: id,
      OR: [{ sourceId: entityId }, { targetId: entityId }],
    },
    include: {
      source: { select: { id: true, label: true, type: true } },
      target: { select: { id: true, label: true, type: true } },
      evidence: {
        include: {
          evidence: {
            select: {
              id: true,
              title: true,
              type: true,
              source: true,
              uploadedAt: true,
              rawContent: true,
              metadata: true,
            },
          },
        },
      },
    },
  });

  // Calculate "Why this entity matters" based on existing analytical signals
  const pendingRels = relationships.filter((r) => r.status === "UNDER_REVIEW" || r.status === "AI_SUGGESTED").length;
  const isMultiCase = investigationCount > 1;
  const hasBridgeMeta = Boolean((entity.metadata as { bridge?: boolean } | null)?.bridge);

  let whyItMatters: string | null = null;
  if (hasBridgeMeta) {
    whyItMatters = "Connects multiple investigation clusters based on structural network analysis.";
  } else if (isMultiCase) {
    whyItMatters = `Appears across ${investigationCount} separate investigations in the system.`;
  } else if (pendingRels > 0) {
    whyItMatters = `Has ${pendingRels} AI-suggested or pending relationship(s) requiring investigator verification.`;
  } else if (relationships.length >= 4) {
    whyItMatters = `High network density with ${relationships.length} active relationships connected to key entities.`;
  } else if (eventsCount > 0 || locationsCount > 0) {
    whyItMatters = `Associated with ${eventsCount} chronological event(s) and ${locationsCount} tracked location(s).`;
  }

  const context = {
    investigationCount,
    relationshipCount: relationships.length,
    evidenceCount: relationshipEvidenceCount,
    eventCount: eventsCount,
    locationCount: locationsCount,
    whyItMatters,
  };

  return NextResponse.json({ entity, relationships, context });
}
