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

    // Mark as VERIFIED (Investigator Approved, ready for Batch 12 Graph Integration)
    await db.candidateFinding.update({
      where: { id: candidateId },
      data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
    });

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
