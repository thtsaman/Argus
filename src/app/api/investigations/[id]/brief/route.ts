import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { generateInvestigationLeads } from "@/lib/investigation/leads";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("investigation:read");
    const { id } = await params;

    const investigation = await db.investigation.findUnique({
      where: { id },
      include: {
        lead: { select: { name: true } },
        relationships: {
          take: 20,
          include: {
            source: { select: { label: true } },
            target: { select: { label: true } },
          },
        },
        entities: {
          take: 15,
          include: {
            _count: { select: { sourceRelations: true, targetRelations: true } },
          },
        },
        events: { take: 10, orderBy: { occurredAt: "desc" } },
        evidence: { select: { id: true, status: true } },
        candidates: { select: { id: true, status: true, label: true, confidence: true } },
      },
    });

    if (!investigation) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    const leads = await generateInvestigationLeads(id);

    const relationships = investigation.relationships || [];
    const entities = investigation.entities || [];
    const evidence = investigation.evidence || [];
    const events = investigation.events || [];
    const candidates = investigation.candidates || [];

    // Calculate status breakdowns
    const verifiedCount = relationships.filter((r: { status: string }) => r.status === "VERIFIED" || r.status === "DIRECT").length;
    const underReviewCount = relationships.filter((r: { status: string }) => r.status === "UNDER_REVIEW").length;
    const rejectedCount = relationships.filter((r: { status: string }) => r.status === "REJECTED").length;
    const aiSuggestedCount = relationships.filter((r: { status: string }) => r.status === "AI_SUGGESTED").length;

    const briefData = {
      investigation: {
        id: investigation.id,
        title: investigation.title,
        caseNumber: investigation.caseNumber,
        status: investigation.status,
        startDate: investigation.startDate?.toISOString() || null,
        endDate: investigation.endDate?.toISOString() || null,
        leadName: investigation.lead?.name || null,
      },
      executiveSummary: `This investigation encompasses ${entities.length} tracked entities and ${relationships.length} relationships. Active lead engine analysis has surfaced ${leads.length} priority leads requiring verification.`,
      keyFindings: candidates.slice(0, 5).map((c: { id: string; label: string; status: string }) => ({
        id: c.id,
        finding: c.label,
        whyItMatters: "Analytical relationship candidate requiring review.",
        status: c.status,
        isInferred: true,
      })),
      leads: leads.map((l) => ({
        id: l.id,
        title: l.title,
        category: l.leadType,
        status: l.status,
        evidenceCount: l.supportingEvidenceIds.length,
      })),
      entities: entities.map((e: { id: string; label: string; type: string; _count: { sourceRelations: number; targetRelations: number } }) => ({
        id: e.id,
        label: e.label,
        type: e.type,
        relationshipCount: e._count.sourceRelations + e._count.targetRelations,
      })),
      relationships: relationships.map((r: { id: string; source: { label: string }; target: { label: string }; type: string; status: string }) => ({
        id: r.id,
        source: r.source.label,
        target: r.target.label,
        type: r.type,
        status: r.status,
      })),
      evidenceSummary: {
        total: evidence.length,
        extracted: evidence.filter((e: { status: string }) => e.status === "EXTRACTED").length,
        pending: evidence.filter((e: { status: string }) => e.status === "PENDING").length,
      },
      verificationStats: {
        verified: verifiedCount,
        underReview: underReviewCount,
        rejected: rejectedCount,
        aiSuggested: aiSuggestedCount,
      },
      recentEvents: events.map((ev: { id: string; title: string; occurredAt: Date }) => ({
        id: ev.id,
        title: ev.title,
        date: ev.occurredAt.toISOString(),
      })),
    };

    return NextResponse.json(briefData);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 });
  }
}
