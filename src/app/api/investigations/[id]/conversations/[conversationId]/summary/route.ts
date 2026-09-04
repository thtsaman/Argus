import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { generateExplanation } from "@/lib/ai/provider";

export async function POST(
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

    const messagesText = conversation.messages
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `Summarize the following investigation conversation thread into three strict sections:
1. KNOWN: Facts established by available evidence.
2. INFERRED: Conclusions or logical connections derived from available information.
3. UNCERTAIN: Unresolved questions or insufficient evidence.

Conversation context:
Title: ${conversation.title}
Context Focus: ${conversation.contextType || "None"} ${conversation.contextLabel || ""}

Messages:
${messagesText || "No messages in conversation yet."}`;

    const { response, error } = await generateExplanation({
      query: prompt,
      context: { focusContext: conversation.contextLabel },
    });

    const summaryObj = {
      rawText: response || "Failed to generate summary.",
      generatedAt: new Date().toISOString(),
      error: error || null,
    };

    await db.conversation.update({
      where: { id: conversationId },
      data: { summary: summaryObj },
    });

    return NextResponse.json({ summary: summaryObj });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate summary" },
      { status: 500 }
    );
  }
}
