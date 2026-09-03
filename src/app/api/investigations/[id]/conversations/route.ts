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

    const conversations = await (db as any).conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

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

    const { contextType, contextId, contextLabel, title } = body;

    const convTitle =
      title ||
      (contextLabel
        ? `${contextLabel} (${contextType || "Focus"})`
        : "Investigation Overview");

    const conversation = await (db as any).conversation.create({
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
