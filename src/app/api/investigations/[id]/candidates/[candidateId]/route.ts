import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { verifyCandidateSchema } from "@/lib/validation/schemas";
import { EntityType, RelationshipStatus, RelationshipType } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const user = await requirePermission("relationship:verify");
    const { id, candidateId } = await params;
    const body = await req.json();
    const parsed = verifyCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const candidate = await db.candidateFinding.findFirst({
      where: { id: candidateId, investigationId: id },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    if (parsed.data.action === "reject") {
      await db.candidateFinding.update({
        where: { id: candidateId },
        data: { status: "REJECTED", verifiedById: user.id, verifiedAt: new Date() },
      });
      await createAuditLog({
        userId: user.id,
        action: "CANDIDATE_REJECTED",
        resourceType: "CandidateFinding",
        resourceId: candidateId,
      });
      return NextResponse.json({ status: "rejected" });
    }

    await db.candidateFinding.update({
      where: { id: candidateId },
      data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
    });

    if (candidate.type === "ENTITY") {
      const data = candidate.data as { type?: string; label?: string };
      await db.entity.create({
        data: {
          investigationId: id,
          type: (data.type as EntityType) || EntityType.PERSON,
          label: data.label || candidate.label,
          description: `Verified from evidence: ${candidate.label}`,
        },
      });
    } else if (candidate.type === "RELATIONSHIP") {
      const data = candidate.data as { source?: string; target?: string; type?: string };
      const entities = await db.entity.findMany({ where: { investigationId: id } });
      const source = entities.find((e) => e.label === data.source);
      const target = entities.find((e) => e.label === data.target);
      if (source && target) {
        await db.relationship.create({
          data: {
            investigationId: id,
            sourceId: source.id,
            targetId: target.id,
            type: (data.type as RelationshipType) || RelationshipType.ASSOCIATED_WITH,
            status: RelationshipStatus.VERIFIED,
            confidence: candidate.confidence,
            verifiedAt: new Date(),
            evidence: {
              create: {
                evidenceId: candidate.evidenceId,
                excerpt: candidate.sourceExcerpt,
              },
            },
          },
        });
      }
    } else if (candidate.type === "EVENT") {
      const data = candidate.data as { title?: string; description?: string; date?: string };
      await db.event.create({
        data: {
          investigationId: id,
          title: data.title || candidate.label,
          description: data.description || candidate.description,
          occurredAt: data.date ? new Date(data.date) : new Date(),
        },
      });
    }

    await createAuditLog({
      userId: user.id,
      action: "CANDIDATE_VERIFIED",
      resourceType: "CandidateFinding",
      resourceId: candidateId,
      metadata: { type: candidate.type },
    });

    return NextResponse.json({ status: "verified" });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
