import { db } from "@/lib/db";
import { buildGraphData, computeBetweenness } from "@/lib/graph/analysis";

export type InfluenceCategory =
  | "Highly Connected"
  | "Network Bridge"
  | "Cross-Group Connector"
  | "Multi-Relationship Entity";

export interface KeyEntityResult {
  entityId: string;
  label: string;
  type: string;
  description: string | null;
  category: InfluenceCategory;
  connectionCount: number;
  distinctRelTypesCount: number;
  betweennessScore: number;
  whyItMatters: string;
  relatedEntityLabels: string[];
  supportingRelationshipTypes: string[];
  supportingEvidenceCount: number;
  evidenceTitles: string[];
}

export async function analyzeKeyEntities(investigationId: string): Promise<KeyEntityResult[]> {
  const [entities, relationships] = await Promise.all([
    db.entity.findMany({
      where: { investigationId },
      include: { aliases: true },
    }),
    db.relationship.findMany({
      where: { investigationId, status: { in: ["DIRECT", "VERIFIED"] } },
      include: {
        evidence: {
          include: {
            evidence: { select: { id: true, title: true } },
          },
        },
      },
    }),
  ]);

  if (entities.length === 0 || relationships.length === 0) {
    return [];
  }

  const graphData = buildGraphData(entities, relationships);
  const betweennessScores = computeBetweenness(graphData);

  const results: KeyEntityResult[] = [];

  for (const entity of entities) {
    const connRels = relationships.filter(
      (r) => r.sourceId === entity.id || r.targetId === entity.id
    );

    if (connRels.length === 0) continue;

    const neighborIds = Array.from(
      new Set(connRels.map((r) => (r.sourceId === entity.id ? r.targetId : r.sourceId)))
    );

    const neighborLabels = neighborIds
      .map((nid) => entities.find((e) => e.id === nid)?.label)
      .filter(Boolean) as string[];

    const relTypes = Array.from(new Set(connRels.map((r) => r.type)));

    const evidenceItems = Array.from(
      new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.title)))
    );

    const bScore = betweennessScores.get(entity.id) || 0;

    // Determine primary influence category and explainable reasoning
    let category: InfluenceCategory | null = null;
    let whyItMatters = "";

    if (bScore > 1.2 && neighborIds.length >= 2) {
      category = "Network Bridge";
      whyItMatters = `Acts as a key structural bridge (score ${bScore.toFixed(
        1
      )}) connecting otherwise weakly connected entity clusters across ${neighborIds.length} neighbors.`;
    } else if (neighborIds.length >= 4) {
      category = "Highly Connected";
      whyItMatters = `Directly connected to ${
        neighborIds.length
      } distinct entities in the network including ${neighborLabels.slice(0, 3).join(", ")}.`;
    } else if (relTypes.length >= 3) {
      category = "Multi-Relationship Entity";
      whyItMatters = `Maintains ${relTypes.length} distinct relationship categories (${relTypes
        .slice(0, 3)
        .join(", ")}) across connected records.`;
    } else if (neighborIds.length >= 2 && relTypes.length >= 2) {
      category = "Cross-Group Connector";
      whyItMatters = `Connects ${neighborIds.length} entities with multiple interaction types (${relTypes.join(
        ", "
      )}).`;
    }

    if (category) {
      results.push({
        entityId: entity.id,
        label: entity.label,
        type: entity.type,
        description: entity.description,
        category,
        connectionCount: neighborIds.length,
        distinctRelTypesCount: relTypes.length,
        betweennessScore: Number(bScore.toFixed(2)),
        whyItMatters,
        relatedEntityLabels: neighborLabels,
        supportingRelationshipTypes: relTypes,
        supportingEvidenceCount: evidenceItems.length,
        evidenceTitles: evidenceItems,
      });
    }
  }

  // Sort by highest connection count & betweenness score
  return results.sort(
    (a, b) => b.betweennessScore + b.connectionCount - (a.betweennessScore + a.connectionCount)
  );
}
