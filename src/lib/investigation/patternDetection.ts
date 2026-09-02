import { db } from "@/lib/db";
import { buildGraphData, computeBetweenness } from "@/lib/graph/analysis";

export const PATTERN_THRESHOLDS = {
  RELATIONSHIP_BURST_COUNT: 3, // 3+ relationships created in short timeframe
  REPEATED_INTERACTION_MIN: 2,  // 2+ direct evidence interactions between same pair
  CROSS_LOCATION_MIN: 2,         // Entity appearing in 2+ distinct locations
  CROSS_GROUP_MIN_NEIGHBORS: 3,  // Connected to 3+ distinct entities spanning sub-groups
} as const;

export type PatternType =
  | "COMMUNICATION_BURST"
  | "NEW_RELATIONSHIP_CLUSTER"
  | "CROSS_LOCATION_ACTIVITY"
  | "REPEATED_INTERACTION"
  | "CROSS_GROUP_CONNECTION"
  | "EVIDENCE_CONFLICT";

export type PatternStatus = "NEW" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export interface DetectedPattern {
  id: string;
  patternType: PatternType;
  title: string;
  entityId?: string;
  entityLabel?: string;
  relatedEntityIds: string[];
  relatedEntityLabels: string[];
  relatedRelationshipIds: string[];
  relatedEventIds: string[];
  supportingEvidenceIds: string[];
  supportingEvidenceTitles: string[];
  detectionReason: string;
  explanation: string;
  status: PatternStatus;
  detectedAt: Date;
  targetView: "Network" | "Timeline" | "Map" | "Evidence";
}

export async function detectSuspiciousPatterns(investigationId: string): Promise<DetectedPattern[]> {
  const [entities, relationships, events, locations] = await Promise.all([
    db.entity.findMany({
      where: { investigationId },
      include: { aliases: true },
    }),
    db.relationship.findMany({
      where: { investigationId, status: { in: ["DIRECT", "VERIFIED"] } },
      include: {
        source: { select: { id: true, label: true, type: true } },
        target: { select: { id: true, label: true, type: true } },
        evidence: {
          include: {
            evidence: { select: { id: true, title: true } },
          },
        },
      },
    }),
    db.event.findMany({
      where: { investigationId },
      include: {
        entity: { select: { id: true, label: true } },
        location: { select: { id: true, name: true } },
        evidenceLinks: { include: { evidence: { select: { id: true, title: true } } } },
      },
    }),
    db.location.findMany({
      where: { investigationId },
    }),
  ]);

  if (entities.length === 0) return [];

  const patterns: DetectedPattern[] = [];
  const graphData = buildGraphData(entities, relationships);
  const betweennessScores = computeBetweenness(graphData);

  // 1. REPEATED INTERACTION PATTERN
  for (const rel of relationships) {
    if (rel.evidence.length >= PATTERN_THRESHOLDS.REPEATED_INTERACTION_MIN) {
      const evTitles = Array.from(new Set(rel.evidence.map((e) => e.evidence.title)));
      const evIds = Array.from(new Set(rel.evidence.map((e) => e.evidence.id)));

      patterns.push({
        id: `pattern-repeat-${rel.id}`,
        patternType: "REPEATED_INTERACTION",
        title: `Repeated Interaction: ${rel.source.label} ↔ ${rel.target.label}`,
        entityId: rel.sourceId,
        entityLabel: rel.source.label,
        relatedEntityIds: [rel.sourceId, rel.targetId],
        relatedEntityLabels: [rel.source.label, rel.target.label],
        relatedRelationshipIds: [rel.id],
        relatedEventIds: [],
        supportingEvidenceIds: evIds,
        supportingEvidenceTitles: evTitles,
        detectionReason: `Multiple direct evidence records (${rel.evidence.length}) link ${rel.source.label} and ${rel.target.label}.`,
        explanation: `${rel.source.label} and ${rel.target.label} have ${rel.evidence.length} separate evidence entries confirming interaction (${rel.type}).`,
        status: "NEW",
        detectedAt: rel.createdAt,
        targetView: "Network",
      });
    }
  }

  // 2. CROSS-LOCATION ACTIVITY PATTERN
  for (const entity of entities) {
    const entityEvents = events.filter((e) => e.entityId === entity.id && e.locationId);
    const uniqueLocIds = Array.from(new Set(entityEvents.map((e) => e.locationId!)));

    if (uniqueLocIds.length >= PATTERN_THRESHOLDS.CROSS_LOCATION_MIN) {
      const locNames = uniqueLocIds
        .map((lid) => locations.find((l) => l.id === lid)?.name)
        .filter(Boolean) as string[];

      const evIds = Array.from(
        new Set(entityEvents.flatMap((e) => e.evidenceLinks.map((el) => el.evidence.id)))
      );
      const evTitles = Array.from(
        new Set(entityEvents.flatMap((e) => e.evidenceLinks.map((el) => el.evidence.title)))
      );

      patterns.push({
        id: `pattern-loc-${entity.id}`,
        patternType: "CROSS_LOCATION_ACTIVITY",
        title: `Cross-Location Activity: ${entity.label}`,
        entityId: entity.id,
        entityLabel: entity.label,
        relatedEntityIds: [entity.id],
        relatedEntityLabels: [entity.label],
        relatedRelationshipIds: [],
        relatedEventIds: entityEvents.map((e) => e.id),
        supportingEvidenceIds: evIds,
        supportingEvidenceTitles: evTitles,
        detectionReason: `Entity appears in ${uniqueLocIds.length} distinct geographic locations across recorded events.`,
        explanation: `${entity.label} is documented across ${uniqueLocIds.length} locations (${locNames.join(
          ", "
        )}) across ${entityEvents.length} distinct timeline events.`,
        status: "NEW",
        detectedAt: new Date(),
        targetView: "Map",
      });
    }
  }

  // 3. CROSS-GROUP CONNECTION PATTERN
  for (const [entityId, score] of betweennessScores.entries()) {
    if (score >= 1.5) {
      const entity = entities.find((e) => e.id === entityId);
      if (!entity) continue;

      const connRels = relationships.filter((r) => r.sourceId === entityId || r.targetId === entityId);
      const neighborIds = Array.from(
        new Set(connRels.map((r) => (r.sourceId === entityId ? r.targetId : r.sourceId)))
      );
      const neighborLabels = neighborIds
        .map((nid) => entities.find((e) => e.id === nid)?.label)
        .filter(Boolean) as string[];

      if (neighborIds.length >= PATTERN_THRESHOLDS.CROSS_GROUP_MIN_NEIGHBORS) {
        const evIds = Array.from(
          new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.id)))
        );
        const evTitles = Array.from(
          new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.title)))
        );

        patterns.push({
          id: `pattern-group-${entity.id}`,
          patternType: "CROSS_GROUP_CONNECTION",
          title: `Cross-Group Connection: ${entity.label}`,
          entityId: entity.id,
          entityLabel: entity.label,
          relatedEntityIds: [entity.id, ...neighborIds.slice(0, 4)],
          relatedEntityLabels: [entity.label, ...neighborLabels.slice(0, 4)],
          relatedRelationshipIds: connRels.map((r) => r.id),
          relatedEventIds: [],
          supportingEvidenceIds: evIds,
          supportingEvidenceTitles: evTitles,
          detectionReason: `High betweenness score (${score.toFixed(
            1
          )}) spanning across ${neighborIds.length} distinct entity clusters.`,
          explanation: `${entity.label} links ${neighborIds.length} entities (${neighborLabels
            .slice(0, 3)
            .join(", ")}) bridging sub-groups in the investigation graph.`,
          status: "NEW",
          detectedAt: new Date(),
          targetView: "Network",
        });
      }
    }
  }

  // 4. RELATIONSHIP BURST / NEW CLUSTER PATTERN
  for (const entity of entities) {
    const connRels = relationships.filter((r) => r.sourceId === entity.id || r.targetId === entity.id);
    if (connRels.length >= PATTERN_THRESHOLDS.RELATIONSHIP_BURST_COUNT) {
      const neighborIds = Array.from(
        new Set(connRels.map((r) => (r.sourceId === entity.id ? r.targetId : r.sourceId)))
      );
      const neighborLabels = neighborIds
        .map((nid) => entities.find((e) => e.id === nid)?.label)
        .filter(Boolean) as string[];

      const evIds = Array.from(
        new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.id)))
      );
      const evTitles = Array.from(
        new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.title)))
      );

      patterns.push({
        id: `pattern-cluster-${entity.id}`,
        patternType: "NEW_RELATIONSHIP_CLUSTER",
        title: `Relationship Cluster: ${entity.label}`,
        entityId: entity.id,
        entityLabel: entity.label,
        relatedEntityIds: [entity.id, ...neighborIds],
        relatedEntityLabels: [entity.label, ...neighborLabels],
        relatedRelationshipIds: connRels.map((r) => r.id),
        relatedEventIds: [],
        supportingEvidenceIds: evIds,
        supportingEvidenceTitles: evTitles,
        detectionReason: `Cluster of ${connRels.length} verified relationships centered around ${entity.label}.`,
        explanation: `${entity.label} forms a central hub for ${connRels.length} verified relationships in this case file.`,
        status: "NEW",
        detectedAt: new Date(),
        targetView: "Network",
      });
    }
  }

  return patterns;
}
