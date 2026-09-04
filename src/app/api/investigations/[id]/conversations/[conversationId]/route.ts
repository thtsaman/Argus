import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { generateExplanation } from "@/lib/ai/provider";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const user = await requirePermission("ai:query");
    const { id, conversationId } = await params;

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, investigationId: id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const user = await requirePermission("ai:query");
    const { id, conversationId } = await params;
    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, investigationId: id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message first
    const userMsg = await db.chatMessage.create({
      data: {
        conversationId,
        role: "user",
        content: query.trim(),
      },
    });

    // Gather targeted context based on focusContext type
    let focusDetails: any = null;
    let relevantEntities: any[] = [];
    let relevantRelationships: any[] = [];
    let relevantEvidence: any[] = [];
    let relevantEvents: any[] = [];
    let relevantLeads: any[] = [];

    const focusType = conversation.contextType;
    const focusId = conversation.contextId;

    if (focusType === "ENTITY" && focusId) {
      const entity = await db.entity.findUnique({
        where: { id: focusId },
        include: {
          sourceRelations: {
            include: {
              target: { select: { id: true, label: true, type: true } },
              evidence: { include: { evidence: { select: { title: true, normalizedContent: true } } } },
            },
          },
          targetRelations: {
            include: {
              source: { select: { id: true, label: true, type: true } },
              evidence: { include: { evidence: { select: { title: true, normalizedContent: true } } } },
            },
          },
        },
      });

      if (entity) {
        focusDetails = {
          id: entity.id,
          label: entity.label,
          type: entity.type,
          description: entity.description,
        };

        const allRels = [...(entity.sourceRelations || []), ...(entity.targetRelations || [])];
        relevantRelationships = allRels.map((r: any) => {
          const isSource = r.sourceId === entity.id;
          const other = isSource ? r.target : r.source;
          return {
            id: r.id,
            connectedEntity: other.label,
            direction: isSource ? `-> ${other.label}` : `<- ${other.label}`,
            type: r.type,
            status: r.status,
            confidence: r.confidence,
            evidenceExcerpts: r.evidence.map((e: any) => ({
              title: e.evidence.title,
              excerpt: e.evidence.normalizedContent?.slice(0, 500),
            })),
          };
        });

        // Find leads involving this entity
        const leads = await db.relationship.findMany({
          where: {
            investigationId: id,
            OR: [{ sourceId: entity.id }, { targetId: entity.id }],
            status: "UNDER_REVIEW",
          },
          include: {
            source: { select: { label: true } },
            target: { select: { label: true } },
            evidence: { include: { evidence: { select: { title: true, normalizedContent: true } } } },
          },
        });

        relevantLeads = leads.map((l: any) => ({
          title: `Unverified link: ${l.source.label} -> ${l.target.label}`,
          status: l.status,
          type: l.type,
          evidence: l.evidence.map((e: any) => ({
            title: e.evidence.title,
            excerpt: e.evidence.normalizedContent?.slice(0, 500),
          })),
        }));
      }
    } else if (focusType === "RELATIONSHIP" && focusId) {
      const rel = await db.relationship.findUnique({
        where: { id: focusId },
        include: {
          source: { select: { id: true, label: true, type: true, description: true } },
          target: { select: { id: true, label: true, type: true, description: true } },
          evidence: { include: { evidence: { select: { title: true, normalizedContent: true } } } },
        },
      });

      if (rel) {
        focusDetails = {
          id: rel.id,
          type: rel.type,
          status: rel.status,
          confidence: rel.confidence,
          sourceEntity: rel.source,
          targetEntity: rel.target,
        };

        relevantRelationships = [
          {
            source: rel.source.label,
            target: rel.target.label,
            type: rel.type,
            status: rel.status,
          },
        ];

        relevantEvidence = rel.evidence.map((e: any) => ({
          title: e.evidence.title,
          excerpt: e.evidence.normalizedContent?.slice(0, 1000),
        }));
      }
    } else {
      // General overview or fallback: grab top items
      const [entities, relationships, evidence, events] = await Promise.all([
        db.entity.findMany({
          where: { investigationId: id },
          take: 20,
          select: { id: true, label: true, type: true, description: true },
        }),
        db.relationship.findMany({
          where: { investigationId: id },
          take: 20,
          include: {
            source: { select: { label: true } },
            target: { select: { label: true } },
            evidence: { include: { evidence: { select: { title: true, normalizedContent: true } } }, take: 2 },
          },
        }),
        db.evidenceItem.findMany({
          where: { investigationId: id },
          take: 5,
          select: { title: true, normalizedContent: true, status: true },
        }),
        db.event.findMany({
          where: { investigationId: id },
          take: 10,
          orderBy: { occurredAt: "desc" },
          select: { title: true, occurredAt: true },
        }),
      ]);

      relevantEntities = entities;
      relevantRelationships = relationships.map((r: any) => ({
        source: r.source.label,
        target: r.target.label,
        status: r.status,
        type: r.type,
        evidence: r.evidence.map((e: any) => ({
          title: e.evidence.title,
          excerpt: e.evidence.normalizedContent?.slice(0, 500),
        })),
      }));
      relevantEvidence = evidence.map((e) => ({
        title: e.title,
        excerpt: e.normalizedContent?.slice(0, 500),
      }));
      relevantEvents = events.map((e) => ({
        title: e.title,
        date: e.occurredAt.toISOString(),
      }));
    }

    // Always fetch open investigation tasks and overarching investigation details
    const [tasks, investigation] = await Promise.all([
      db.investigationTask.findMany({
        where: { investigationId: id, status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } },
        take: 10,
        select: {
          id: true,
          title: true,
          description: true,
          whyItMatters: true,
          priority: true,
          expectedOutcome: true,
        },
      }),
      db.investigation.findUnique({
        where: { id },
        select: { title: true, description: true, caseNumber: true },
      }),
    ]);

    const context = {
      investigation,
      focusContext: conversation.contextType
        ? {
            type: conversation.contextType,
            id: conversation.contextId,
            label: conversation.contextLabel,
            details: focusDetails,
          }
        : null,
      relevantEntities,
      relevantRelationships,
      relevantEvidence,
      relevantEvents,
      relevantLeads,
      openInvestigationTasks: tasks,
    };

    const { response, error } = await generateExplanation({
      query,
      context,
    });

    const assistantMsg = await db.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: response || "No response generated.",
        error: error || null,
      },
    });

    // Touch conversation updatedAt
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      action: "AI_QUERY_EXECUTED",
      resourceType: "Conversation",
      resourceId: conversationId,
      metadata: { query: query.slice(0, 100), contextType: conversation.contextType },
    });

    return NextResponse.json({
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const user = await requirePermission("ai:query");
    const { id, conversationId } = await params;

    const conversation = await db.conversation.findFirst({
      where: { id: conversationId, investigationId: id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await db.conversation.delete({
      where: { id: conversationId },
    });

    await createAuditLog({
      userId: user.id,
      action: "INVESTIGATION_UPDATED",
      resourceType: "Conversation",
      resourceId: conversationId,
      metadata: { action: "DELETE_CONVERSATION", title: conversation.title },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
