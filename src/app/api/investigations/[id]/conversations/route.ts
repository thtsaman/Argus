import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("ai:query");
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const contextType = searchParams.get("contextType");
    const contextId = searchParams.get("contextId");

    const where: any = { investigationId: id };
    if (contextType) where.contextType = contextType;
    if (contextId) where.contextId = contextId;

    const conversations = await db.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (contextType && contextId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const dailyThread = conversations.find(
        (c) => new Date(c.createdAt) >= todayStart
      );

      if (dailyThread) {
        return NextResponse.json({ conversations: [dailyThread, ...conversations.filter(c => c.id !== dailyThread.id)] });
      }
    }

    return NextResponse.json({ conversations });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("ai:query");
    const { id } = await params;
    const body = await req.json();

    const { contextType, contextId, contextLabel, title, forceNew } = body;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // If context is provided and forceNew is not true, look for existing daily thread
    if (contextType && contextId && !forceNew) {
      const existingDaily = await db.conversation.findFirst({
        where: {
          investigationId: id,
          contextType,
          contextId,
          createdAt: { gte: todayStart },
        },
        orderBy: { createdAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (existingDaily) {
        return NextResponse.json({ conversation: existingDaily });
      }
    }

    const dateStr = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const convTitle =
      title ||
      (contextLabel
        ? `${contextLabel} (${dateStr})`
        : `Overview (${dateStr})`);

    const conversation = await db.conversation.create({
      data: {
        investigationId: id,
        userId: user.id,
        contextType: contextType || null,
        contextId: contextId || null,
        contextLabel: contextLabel || null,
        title: convTitle,
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create conversation" },
      { status: 500 }
    );
  }
}
