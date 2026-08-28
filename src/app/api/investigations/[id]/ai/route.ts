import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { generateExplanation } from "@/lib/ai/provider";
import { aiQuerySchema } from "@/lib/validation/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("ai:query");
    const { id } = await params;
    const body = await req.json();
    const parsed = aiQuerySchema.safeParse({ ...body, investigationId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

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
      pendingReview: await db.candidateFinding.count({
        where: { investigationId: id, status: "PENDING" },
      }),
    };

    const { response, error } = await generateExplanation({
      query: parsed.data.query,
      context,
    });

    await db.aIInsight.create({
      data: {
        investigationId: id,
        userId: user.id,
        query: parsed.data.query,
        response,
        context,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "AI_QUERY_EXECUTED",
      resourceType: "Investigation",
      resourceId: id,
      metadata: { query: parsed.data.query.slice(0, 100) },
    });

    return NextResponse.json({ response, error });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI query failed" },
      { status: 500 }
    );
  }
}
