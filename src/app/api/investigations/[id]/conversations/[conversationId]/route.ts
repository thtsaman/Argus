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

    const conversation = await (db as any).conversation.findFirst({
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

    const conversation = await (db as any).conversation.findFirst({
      where: { id: conversationId, investigationId: id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message first
    const userMsg = await (db as any).chatMessage.create({
      data: {
        conversationId,
        role: "user",
        content: query.trim(),
      },
    });

    // Gather context based on investigation & focusContext
    const focusContext = conversation.contextType
      ? {
          type: conversation.contextType,
          id: conversation.contextId,
          label: conversation.contextLabel,
        }
      : null;

    const [entities, relationships, evidence, events] = await Promise.all([
      db.entity.findMany({
        where: { investigationId: id },
        take: 50,
        select: { id: true, label: true, type: true, description: true },
      }),
      db.relationship.findMany({
        where: { investigationId: id },
        take: 50,
        include: {
          source: { select: { label: true } },
          target: { select: { label: true } },
          evidence: { include: { evidence: { select: { title: true } } }, take: 2 },
        },
      }),
      db.evidenceItem.findMany({
        where: { investigationId: id },
        take: 10,
        select: { title: true, normalizedContent: true, status: true },
      }),
      db.event.findMany({
        where: { investigationId: id },
        take: 20,
        orderBy: { occurredAt: "desc" },
        select: { title: true, occurredAt: true },
      }),
    ]);

    const context = {
      focusContext,
      entities: entities.map((e) => ({ label: e.label, type: e.type })),
      relationships: relationships.map((r) => ({
        source: r.source.label,
        target: r.target.label,
        status: r.status,
        type: r.type,
        evidence: r.evidence.map((e) => e.evidence.title),
      })),
      evidence: evidence.map((e) => ({
        title: e.title,
        excerpt: e.normalizedContent?.slice(0, 300),
      })),
      recentEvents: events.map((e) => ({
        title: e.title,
        date: e.occurredAt.toISOString(),
      })),
    };

    const { response, error } = await generateExplanation({
      query,
      context,
    });

    const assistantMsg = await (db as any).chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: response || "No response generated.",
        error: error || null,
      },
    });

    // Touch conversation updatedAt
    await (db as any).conversation.update({
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

    const conversation = await (db as any).conversation.findFirst({
      where: { id: conversationId, investigationId: id },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await (db as any).conversation.delete({
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
