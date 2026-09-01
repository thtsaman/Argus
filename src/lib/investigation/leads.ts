import { db } from "@/lib/db";
import { buildGraphData, computeBetweenness } from "@/lib/graph/analysis";

export type LeadType =
  | "POTENTIAL_BRIDGE"
  | "UNVERIFIED_RELATIONSHIP"
  | "EVIDENCE_CONFLICT"
  | "CROSS_CASE_CONNECTION"
  | "EVIDENCE_GAP";

export type LeadPriority = "HIGH" | "MEDIUM" | "LOW";

export type LeadStatus = "NEW" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";

export interface InvestigationLead {
  id: string;
  leadType: LeadType;
  title: string;
  shortDescription: string;
  priority: LeadPriority;
  status: LeadStatus;
  reason: string;
  explanationBullets: string[];
  relatedEntityIds: string[];
  relatedEntityLabels: string[];
  relatedRelationshipId?: string;
  supportingEvidenceIds: string[];
  supportingEvidenceTitles: string[];
  crossCaseCount?: number;
  sourceEntityId?: string;
  targetEntityId?: string;
}

export async function generateInvestigationLeads(investigationId: string): Promise<InvestigationLead[]> {
  const [entities, relationships, events, candidates] = await Promise.all([
    db.entity.findMany({
      where: { investigationId },
      include: { aliases: true },
    }),
    db.relationship.findMany({
      where: { investigationId },
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
      },
    }),
    db.candidateFinding.findMany({
      where: { investigationId, status: "PENDING" },
      include: {
        evidence: { select: { id: true, title: true } },
      },
    }),
  ]);

  const leads: InvestigationLead[] = [];

  // Build network graph data to detect structural bridges
  const graphData = buildGraphData(entities, relationships);
  const betweennessScores = computeBetweenness(graphData);

  // 1. POTENTIAL BRIDGE LEADS
  for (const [entityId, score] of betweennessScores.entries()) {
    if (score > 1.5) {
      const entity = entities.find((e) => e.id === entityId);
      if (!entity) continue;

      const connRels = relationships.filter((r) => r.sourceId === entityId || r.targetId === entityId);
      const neighborIds = Array.from(
        new Set(connRels.map((r) => (r.sourceId === entityId ? r.targetId : r.sourceId)))
      );
      const neighborLabels = neighborIds
        .map((nid) => entities.find((e) => e.id === nid)?.label)
        .filter(Boolean) as string[];

      const evidenceIds = Array.from(
        new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.id)))
      );
      const evidenceTitles = Array.from(
        new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.title)))
      );

      leads.push({
        id: `lead-bridge-${entity.id}`,
        leadType: "POTENTIAL_BRIDGE",
        title: `Potential Bridge Entity: ${entity.label}`,
        shortDescription: `${entity.label} connects distinct sub-clusters in the investigation graph (structural centrality score ${score.toFixed(1)}).`,
        priority: "HIGH",
        status: "NEW",
        reason: "Surfaced due to high betweenness centrality spanning across network clusters.",
        explanationBullets: [
          `${entity.label} (${entity.type}) acts as a key structural connector.`,
          `Connected to ${neighborIds.length} adjacent entities including ${neighborLabels.slice(0, 3).join(", ")}.`,
          `Removing or verifying connections through ${entity.label} impacts graph connectivity between sub-groups.`,
          `Supported by ${evidenceIds.length} evidence record(s).`,
        ],
        relatedEntityIds: [entity.id, ...neighborIds.slice(0, 3)],
        relatedEntityLabels: [entity.label, ...neighborLabels.slice(0, 3)],
        supportingEvidenceIds: evidenceIds,
        supportingEvidenceTitles: evidenceTitles,
        sourceEntityId: entity.id,
      });
    }
  }

  // 2. CROSS-CASE CONNECTION LEADS
  const entityLabels = Array.from(new Set(entities.map((e) => e.label)));
  if (entityLabels.length > 0) {
    const globalMatches = await db.entity.findMany({
      where: {
        label: { in: entityLabels },
        investigationId: { not: investigationId },
      },
      select: {
        label: true,
        investigationId: true,
        investigation: { select: { caseNumber: true, title: true } },
      },
    });

    const crossCaseMap = new Map<string, { count: number; cases: string[] }>();
    for (const match of globalMatches) {
      const existing = crossCaseMap.get(match.label) || { count: 1, cases: [] };
      existing.count += 1;
      if (match.investigation?.caseNumber && !existing.cases.includes(match.investigation.caseNumber)) {
        existing.cases.push(match.investigation.caseNumber);
      }
      crossCaseMap.set(match.label, existing);
    }

    for (const [label, meta] of crossCaseMap.entries()) {
      const localEntity = entities.find((e) => e.label === label);
      if (!localEntity) continue;

      const connRels = relationships.filter((r) => r.sourceId === localEntity.id || r.targetId === localEntity.id);
      const evidenceIds = Array.from(
        new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.id)))
      );
      const evidenceTitles = Array.from(
        new Set(connRels.flatMap((r) => r.evidence.map((e) => e.evidence.title)))
      );

      leads.push({
        id: `lead-crosscase-${localEntity.id}`,
        leadType: "CROSS_CASE_CONNECTION",
        title: `Cross-Case Connection: ${localEntity.label}`,
        shortDescription: `${localEntity.label} matches entities appearing across ${meta.cases.length + 1} separate investigations (${meta.cases.join(", ")}).`,
        priority: "HIGH",
        status: "NEW",
        reason: "Shared entity identity detected across multiple case files.",
        explanationBullets: [
          `${localEntity.label} appears in this investigation and ${meta.cases.length} other case(s): ${meta.cases.join(", ")}.`,
          `Potential cross-jurisdictional or multi-investigation link requiring verification.`,
          `Associated with ${connRels.length} relationship(s) in current case graph.`,
        ],
        relatedEntityIds: [localEntity.id],
        relatedEntityLabels: [localEntity.label],
        supportingEvidenceIds: evidenceIds,
        supportingEvidenceTitles: evidenceTitles,
        crossCaseCount: meta.cases.length + 1,
        sourceEntityId: localEntity.id,
      });
    }
  }

  // 3. UNVERIFIED RELATIONSHIP LEADS
  const unverifiedRels = relationships.filter(
    (r) => r.status === "UNDER_REVIEW" || r.status === "AI_SUGGESTED"
  );
  for (const rel of unverifiedRels) {
    const evidenceIds = rel.evidence.map((e) => e.evidence.id);
    const evidenceTitles = rel.evidence.map((e) => e.evidence.title);

    const hasMultipleEvidence = rel.evidence.length >= 2;
    const priority: LeadPriority = hasMultipleEvidence ? "HIGH" : "MEDIUM";

    leads.push({
      id: `lead-unverified-${rel.id}`,
      leadType: "UNVERIFIED_RELATIONSHIP",
      title: `Unverified Relationship: ${rel.source.label} → ${rel.target.label}`,
      shortDescription: `Relationship (${rel.type}) is currently ${rel.status.replace("_", " ").toLowerCase()} and requires investigator review.`,
      priority,
      status: "NEW",
      reason: `Relationship status is ${rel.status}.`,
      explanationBullets: [
        `Connection between ${rel.source.label} (${rel.source.type}) and ${rel.target.label} (${rel.target.type}) is under review.`,
        `Assigned confidence score: ${rel.confidence != null ? Math.round(rel.confidence * 100) + "%" : "Not specified"}.`,
        `Supported by ${evidenceIds.length} evidence item(s).`,
        `Requires explicit investigator verification or rejection.`,
      ],
      relatedEntityIds: [rel.sourceId, rel.targetId],
      relatedEntityLabels: [rel.source.label, rel.target.label],
      relatedRelationshipId: rel.id,
      supportingEvidenceIds: evidenceIds,
      supportingEvidenceTitles: evidenceTitles,
      sourceEntityId: rel.sourceId,
      targetEntityId: rel.targetId,
    });
  }

  // 4. EVIDENCE GAP LEADS
  const zeroEvidenceRels = relationships.filter((r) => r.evidence.length === 0);
  for (const rel of zeroEvidenceRels) {
    leads.push({
      id: `lead-gap-${rel.id}`,
      leadType: "EVIDENCE_GAP",
      title: `Evidence Gap: ${rel.source.label} → ${rel.target.label}`,
      shortDescription: `Connection (${rel.type}) exists in graph but lacks direct attached evidence records.`,
      priority: "MEDIUM",
      status: "NEW",
      reason: "No direct evidence documents currently link this relationship.",
      explanationBullets: [
        `Relationship ${rel.source.label} → ${rel.target.label} lacks direct evidence files.`,
        `Analytical confidence is limited until primary documentation is attached.`,
        `Consider reviewing raw evidence intake or requesting supplementary data.`,
      ],
      relatedEntityIds: [rel.sourceId, rel.targetId],
      relatedEntityLabels: [rel.source.label, rel.target.label],
      relatedRelationshipId: rel.id,
      supportingEvidenceIds: [],
      supportingEvidenceTitles: [],
      sourceEntityId: rel.sourceId,
      targetEntityId: rel.targetId,
    });
  }

  // 5. EVIDENCE CONFLICT LEADS (from CandidateFindings or overlapping events)
  const conflictCandidates = candidates.filter(
    (c) => c.type === "LOCATION" || c.type === "EVENT" || (c.description && c.description.toLowerCase().includes("conflict"))
  );
  for (const cand of conflictCandidates) {
    leads.push({
      id: `lead-conflict-${cand.id}`,
      leadType: "EVIDENCE_CONFLICT",
      title: `Possible Evidence Inconsistency: ${cand.label}`,
      shortDescription: cand.description || "Potential location or temporal discrepancy requiring verification.",
      priority: "MEDIUM",
      status: "NEW",
      reason: "Conflicting or unverified candidate finding extracted from evidence.",
      explanationBullets: [
        `Extracted finding '${cand.label}' indicates potential data discrepancy.`,
        `Confidence score: ${cand.confidence ? Math.round(cand.confidence * 100) + "%" : "Unrated"}.`,
        `Requires manual review against primary source records.`,
      ],
      relatedEntityIds: cand.entityId ? [cand.entityId] : [],
      relatedEntityLabels: cand.label ? [cand.label] : [],
      supportingEvidenceIds: cand.evidence ? [cand.evidence.id] : [],
      supportingEvidenceTitles: cand.evidence ? [cand.evidence.title] : [],
    });
  }

  // Sort leads by Priority (HIGH > MEDIUM > LOW)
  const priorityOrder: Record<LeadPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return leads.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
