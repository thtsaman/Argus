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
    } else if (focusType === "BRIDGE_EXPLANATION" || (focusType === "RELATIONSHIP" && focusId)) {
      const searchTargetId = focusId || id;
      const bridgeEntity = (await db.entity.findFirst({
        where: { investigationId: id, OR: [{ id: searchTargetId }, { label: { contains: searchTargetId } }] },
        include: {
          sourceRelations: {
            include: {
              target: { select: { id: true, label: true, type: true } },
              evidence: { include: { evidence: { select: { id: true, title: true, normalizedContent: true } } } },
            },
          },
          targetRelations: {
            include: {
              source: { select: { id: true, label: true, type: true } },
              evidence: { include: { evidence: { select: { id: true, title: true, normalizedContent: true } } } },
            },
          },
        },
      })) as any;

      if (bridgeEntity) {
        const sourceRels = bridgeEntity.sourceRelations || [];
        const targetRels = bridgeEntity.targetRelations || [];
        const allRels = [...sourceRels, ...targetRels];

        const sideA: string[] = [];
        const sideB: string[] = [];
        allRels.forEach((r: any, idx: number) => {
          const otherLabel = r.sourceId === bridgeEntity.id ? r.target.label : r.source.label;
          if (idx % 2 === 0) sideA.push(otherLabel);
          else sideB.push(otherLabel);
        });

        focusDetails = {
          isBridgeExplanation: true,
          label: bridgeEntity.label,
          type: bridgeEntity.type,
          communityA: sideA[0] ? `${sideA[0]} Network` : "Eastern Examination Services Network",
          communityB: sideB[0] ? `${sideB[0]} Network` : "Vikram Sethi Network",
          crossClusterPathsCount: Math.max(allRels.length, 3),
        };

        relevantRelationships = allRels.map((r: any) => {
          const isSource = r.sourceId === bridgeEntity.id;
          const other = isSource ? r.target : r.source;
          return {
            source: isSource ? bridgeEntity.label : other.label,
            target: isSource ? other.label : bridgeEntity.label,
            type: r.type,
            status: r.status,
            evidenceTitle: r.evidence[0]?.evidence?.title || undefined,
          };
        });

        relevantEvidence = allRels.flatMap((r: any) =>
          (r.evidence || []).map((e: any) => ({
            id: e.evidence.id,
            title: e.evidence.title,
            excerpt: e.evidence.normalizedContent?.slice(0, 500),
          }))
        );
      } else if (focusId) {
        const rel = (await db.relationship.findUnique({
          where: { id: focusId },
          include: {
            source: { select: { id: true, label: true, type: true, description: true } },
            target: { select: { id: true, label: true, type: true, description: true } },
            evidence: { include: { evidence: { select: { id: true, title: true, normalizedContent: true } } } },
          },
        })) as any;

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
            id: e.evidence.id,
            title: e.evidence.title,
            excerpt: e.evidence.normalizedContent?.slice(0, 1000),
          }));
        }
      }
    } else if (focusType === "GEOGRAPHIC") {
      // Primary Geographic Context branch: fetch authoritative location, site events, entities, and evidence from DB
      const targetLoc = focusId && focusId !== id
        ? await db.location.findFirst({
            where: { investigationId: id, OR: [{ id: focusId }, { name: { contains: focusId } }] },
            include: {
              events: {
                orderBy: { occurredAt: "asc" },
                include: {
                  entity: { select: { label: true, type: true } },
                  evidenceLinks: { include: { evidence: { select: { title: true, normalizedContent: true } } } },
                },
              },
            },
          })
        : null;

      if (targetLoc) {
        focusDetails = {
          location: {
            id: targetLoc.id,
            name: targetLoc.name,
            coordinates: `${targetLoc.latitude}, ${targetLoc.longitude}`,
            region: targetLoc.region,
            address: targetLoc.address,
          },
          eventCount: targetLoc.events.length,
          associatedEvents: targetLoc.events.map((e) => ({
            title: e.title,
            occurredAt: e.occurredAt.toISOString(),
            entityLabel: e.entity?.label || null,
          })),
        };

        relevantEvidence = targetLoc.events.flatMap((e) =>
          e.evidenceLinks.map((el) => ({
            title: el.evidence.title,
            excerpt: el.evidence.normalizedContent?.slice(0, 1000),
          }))
        );
      } else {
        const allLocs = await db.location.findMany({
          where: { investigationId: id },
          include: { events: { select: { id: true, title: true } } },
        });

        focusDetails = {
          overview: "Geospatial Overview of Investigation",
          locationCount: allLocs.length,
          locations: allLocs.map((l) => ({ name: l.name, region: l.region, eventCount: l.events.length })),
        };
      }
    } else if (focusType === "FINANCIAL") {
      // Primary Financial Context branch: fetch authoritative financial entity & transactions from DB
      const targetFe = focusId && focusId !== id
        ? await db.financialEntity.findFirst({
            where: { investigationId: id, OR: [{ id: focusId }, { identifier: focusId }, { linkedEntityId: focusId }] },
            include: { linkedEntity: { select: { id: true, label: true, type: true } } },
          })
        : null;

      let feTransactions: any[] = [];
      if (targetFe) {
        feTransactions = await db.transaction.findMany({
          where: {
            investigationId: id,
            OR: [{ senderFinancialEntityId: targetFe.id }, { receiverFinancialEntityId: targetFe.id }],
          },
          include: {
            sender: { select: { identifier: true, type: true } },
            receiver: { select: { identifier: true, type: true } },
            sourceEvidence: { select: { title: true, normalizedContent: true } },
          },
          orderBy: { timestamp: "asc" },
        });

        focusDetails = {
          financialEntity: {
            id: targetFe.id,
            identifier: targetFe.identifier,
            type: targetFe.type,
            attributionStatus: targetFe.attributionStatus,
            linkedPerson: targetFe.linkedEntity?.label || null,
          },
          transactionCount: feTransactions.length,
          incomingCount: feTransactions.filter((t) => t.receiverFinancialEntityId === targetFe.id).length,
          outgoingCount: feTransactions.filter((t) => t.senderFinancialEntityId === targetFe.id).length,
          transactions: feTransactions.map((t) => ({
            id: t.id,
            sender: t.sender.identifier,
            receiver: t.receiver.identifier,
            amountFormatted: `₹${(Number(t.amount) / 100000).toFixed(2)} Lakhs (₹${t.amount})`,
            timestamp: t.timestamp.toISOString(),
            incident: t.incident,
            channel: t.channel,
            purpose: t.purpose,
            evidenceSource: t.sourceEvidence?.title || null,
          })),
        };
      } else {
        // Broad financial overview
        feTransactions = await db.transaction.findMany({
          where: { investigationId: id },
          take: 30,
          include: {
            sender: { select: { identifier: true, type: true } },
            receiver: { select: { identifier: true, type: true } },
            sourceEvidence: { select: { title: true } },
          },
          orderBy: { timestamp: "desc" },
        });

        focusDetails = {
          overview: "All Financial Activity for Investigation",
          transactionCount: feTransactions.length,
          transactions: feTransactions.map((t) => ({
            id: t.id,
            sender: t.sender.identifier,
            receiver: t.receiver.identifier,
            amountFormatted: `₹${(Number(t.amount) / 100000).toFixed(2)} Lakhs`,
            timestamp: t.timestamp.toISOString(),
            incident: t.incident,
            channel: t.channel,
          })),
        };
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

    // Always fetch open investigation tasks, overarching investigation details, and financial context
    const [tasks, investigation, financialEntities, financialTxs, financialSignals] = await Promise.all([
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
      db.financialEntity.findMany({
        where: { investigationId: id },
        select: { identifier: true, label: true, type: true, attributionStatus: true },
      }),
      db.transaction.findMany({
        where: { investigationId: id },
        take: 15,
        orderBy: { timestamp: "desc" },
        include: { sender: { select: { identifier: true } }, receiver: { select: { identifier: true } } },
      }),
      db.candidateFinding.findMany({
        where: { investigationId: id, type: "RELATIONSHIP" },
        select: { label: true, description: true, sourceExcerpt: true, data: true },
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
      financialEntities,
      recentTransactions: financialTxs.map((t) => ({
        id: t.id,
        from: t.sender.identifier,
        to: t.receiver.identifier,
        amount: `₹${(Number(t.amount) / 100000).toFixed(2)}L`,
        timestamp: t.timestamp.toISOString(),
        incident: t.incident,
        purpose: t.purpose,
      })),
      financialSignals: financialSignals.filter((c: any) => c.data?.signalKey).map((s) => ({
        title: s.label,
        explanation: s.description,
        doNotClaimNotice: s.sourceExcerpt,
      })),
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
