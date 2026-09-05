import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  const { id, entityId } = await params;

  let entity = await db.entity.findFirst({
    where: { id: entityId, investigationId: id },
    include: { aliases: true },
  });

  if (!entity) {
    // Check if entityId refers to a FinancialEntity instead
    const fe = await db.financialEntity.findFirst({
      where: { id: entityId, investigationId: id },
      include: { linkedEntity: true },
    });

    if (fe) {
      if (fe.linkedEntityId && fe.linkedEntity) {
        entity = await db.entity.findFirst({
          where: { id: fe.linkedEntityId, investigationId: id },
          include: { aliases: true },
        });
      } else {
        // Construct a synthetic Entity detail representation for unassigned financial entities
        entity = {
          id: fe.id,
          investigationId: id,
          label: fe.identifier,
          type: fe.type,
          description: `Financial account (${fe.attributionStatus})`,
          aliases: [],
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;
      }
    }
  }

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  // Fetch investigation context counts
  const [investigationCount, eventsCount, relationshipEvidenceCount] = await Promise.all([
    db.entity.count({
      where: { label: entity.label },
    }),
    db.event.count({
      where: { investigationId: id, entityId },
    }),
    db.relationshipEvidence.count({
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

  // Fetch associated events, candidate findings/leads, evidence items, and financial activity for deep dynamic analysis
  const [events, candidateFindings, relationshipLinks, linkedFinancialEntities] = await Promise.all([
    db.event.findMany({
      where: {
        investigationId: id,
        entityId,
      },
      select: { id: true, title: true, occurredAt: true, location: true },
    }),
    db.candidateFinding.findMany({
      where: {
        investigationId: id,
        OR: [
          { data: { path: ["sourceLabel"], equals: entity.label } },
          { data: { path: ["targetLabel"], equals: entity.label } },
        ],
      },
      select: { id: true, label: true, description: true, status: true },
    }),
    db.relationshipEvidence.findMany({
      where: {
        relationship: { OR: [{ sourceId: entityId }, { targetId: entityId }], investigationId: id },
      },
      include: {
        evidence: { select: { id: true, title: true, type: true, source: true } },
      },
    }),
    db.financialEntity.findMany({
      where: { investigationId: id, linkedEntityId: entityId },
      include: {
        sentTransactions: { select: { amount: true } },
        receivedTransactions: { select: { amount: true } },
      },
    }),
  ]);

  // Calculate financial activity totals for entity
  let totalFinancialReceived = 0;
  let totalFinancialSent = 0;
  let totalFinancialTxCount = 0;
  linkedFinancialEntities.forEach((fe) => {
    fe.sentTransactions.forEach((t) => {
      totalFinancialSent += Number(t.amount);
      totalFinancialTxCount++;
    });
    fe.receivedTransactions.forEach((t) => {
      totalFinancialReceived += Number(t.amount);
      totalFinancialTxCount++;
    });
  });

  const evidenceItems = Array.from(
    new Map(relationshipLinks.map((rl) => [rl.evidence.id, rl.evidence])).values()
  );

  // Extract connected entity labels by type / relationship status
  const connectedPersons = relationships
    .map((r) => (r.source.id === entityId ? r.target : r.source))
    .filter((e) => e.type === "PERSON");
  const connectedOrgs = relationships
    .map((r) => (r.source.id === entityId ? r.target : r.source))
    .filter((e) => e.type === "ORGANIZATION");
  const verifiedRels = relationships.filter((r) => r.status === "VERIFIED" || r.status === "DIRECT");
  const pendingRels = relationships.filter((r) => r.status === "UNDER_REVIEW" || r.status === "AI_SUGGESTED");

  // 1. DYNAMIC "WHY THIS ENTITY MATTERS"
  const whyItMattersParts: string[] = [];

  if (connectedOrgs.length > 0) {
    const orgNames = Array.from(new Set(connectedOrgs.map((o) => o.label))).join(", ");
    whyItMattersParts.push(`Recorded connection to organization(s) (${orgNames}).`);
  }

  if (connectedPersons.length > 0) {
    const personNames = Array.from(new Set(connectedPersons.map((p) => p.label))).join(", ");
    whyItMattersParts.push(`Direct or inferred communications with ${connectedPersons.length} key person(s) (${personNames}).`);
  }

  if (events.length > 0) {
    whyItMattersParts.push(`Associated with ${events.length} chronological event record(s) in this investigation.`);
  }

  if (pendingRels.length > 0) {
    whyItMattersParts.push(`Has ${pendingRels.length} unverified AI-suggested link(s) requiring analyst review.`);
  }

  if (investigationCount > 1) {
    whyItMattersParts.push(`Cross-case overlap: appears across ${investigationCount} separate investigations.`);
  }

  whyItMattersParts.push("Note: Observed overlaps justify further investigation, but available evidence does not establish criminal involvement.");

  const whyItMatters = whyItMattersParts.join(" ");

  // 2. DYNAMIC "INVESTIGATION RELEVANCE"
  const relevanceParts: string[] = [];
  if (events.length > 0) {
    const eventTitles = events.slice(0, 3).map((e) => e.title).join("; ");
    relevanceParts.push(`Appears in event records: ${eventTitles}.`);
  }
  if (evidenceItems.length > 0) {
    const evidenceTitles = evidenceItems.slice(0, 3).map((e) => `"${e.title}"`).join(", ");
    relevanceParts.push(`Referenced in evidence sources: ${evidenceTitles}.`);
  }
  if (relationships.length > 0) {
    relevanceParts.push(`Maintains ${relationships.length} network connection(s) within the investigation graph.`);
  }
  const investigationRelevance = relevanceParts.length > 0 ? relevanceParts.join(" ") : "Appears as an identified entity record in this case.";

  // 3. DYNAMIC "WHAT TO INVESTIGATE NEXT" (3-5 concrete actions with exact types)
  const whatToInvestigateNext: {
    id: string;
    action: string;
    type: "View Evidence" | "Show in Network" | "View Timeline" | "View Relationship" | "Ask Vyom AI";
    targetId?: string;
    entityId?: string;
  }[] = [];

  // Action 1: Communication / Person verification
  if (connectedPersons.length > 0) {
    const p = connectedPersons[0];
    const rel = relationships.find((r) => r.source.id === p.id || r.target.id === p.id);
    whatToInvestigateNext.push({
      id: `act-rel-${p.id}`,
      action: `Review communications and relationship link with ${p.label}.`,
      type: "View Relationship",
      targetId: rel?.id,
    });
  }

  // Action 2: Evidence review
  if (evidenceItems.length > 0) {
    whatToInvestigateNext.push({
      id: `act-ev-${evidenceItems[0].id}`,
      action: `Examine primary supporting record "${evidenceItems[0].title}".`,
      type: "View Evidence",
      targetId: evidenceItems[0].id,
    });
  }

  // Action 3: Timeline / Event verification
  if (events.length > 0) {
    whatToInvestigateNext.push({
      id: `act-ev-timeline`,
      action: `Verify chronological activity surrounding "${events[0].title}".`,
      type: "View Timeline",
      entityId,
    });
  } else {
    whatToInvestigateNext.push({
      id: `act-timeline-general`,
      action: `Cross-reference entity activity timestamps against overall investigation timeline.`,
      type: "View Timeline",
      entityId,
    });
  }

  // Action 4: Unverified leads / Graph focus
  if (pendingRels.length > 0) {
    const unverified = pendingRels[0];
    const otherLabel = unverified.source.id === entityId ? unverified.target.label : unverified.source.label;
    whatToInvestigateNext.push({
      id: `act-pending-${unverified.id}`,
      action: `Verify unconfirmed AI link between ${entity.label} and ${otherLabel}.`,
      type: "Show in Network",
      targetId: unverified.id,
    });
  } else {
    whatToInvestigateNext.push({
      id: `act-graph-focus`,
      action: `Isolate entity's immediate 1-hop neighborhood in the graph network.`,
      type: "Show in Network",
      targetId: entityId,
    });
  }

  // Action 5: Vyom AI Contextual Deep-Dive
  whatToInvestigateNext.push({
    id: `act-vyom-query`,
    action: `Ask Vyom AI for evidence-grounded summary of ${entity.label}'s role across all records.`,
    type: "Ask Vyom AI",
    entityId,
  });

  const context = {
    investigationCount,
    relationshipCount: relationships.length,
    evidenceCount: relationshipEvidenceCount,
    eventCount: eventsCount,
    locationCount: entity.type === "LOCATION" ? 1 : 0,
    whyItMatters,
    investigationRelevance,
    whatToInvestigateNext: whatToInvestigateNext.slice(0, 5),
    financialActivity: {
      linkedAccountsCount: linkedFinancialEntities.length,
      txCount: totalFinancialTxCount,
      receivedAmount: totalFinancialReceived,
      sentAmount: totalFinancialSent,
      accounts: linkedFinancialEntities.map((f) => ({
        id: f.id,
        identifier: f.identifier,
        label: f.label,
        type: f.type,
        attributionStatus: f.attributionStatus,
      })),
    },
  };

  return NextResponse.json({ entity, relationships, context });
}
