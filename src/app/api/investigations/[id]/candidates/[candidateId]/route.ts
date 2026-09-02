import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { verifyCandidateSchema } from "@/lib/validation/schemas";
import { integrateApprovedCandidate } from "@/lib/investigation/graphIntegration";

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

    // Integrate approved candidate into trusted graph
    const result = await integrateApprovedCandidate(candidateId, user.id);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to integrate candidate into trusted graph" },
        { status: 500 }
      );
    }

    // Mark as VERIFIED (Approved & Integrated)
    await db.candidateFinding.update({
      where: { id: candidateId },
      data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      action: "CANDIDATE_VERIFIED",
      resourceType: "CandidateFinding",
      resourceId: candidateId,
      metadata: {
        type: candidate.type,
        integrationAction: result.action,
        trustedEntityId: result.trustedEntityId,
        trustedRelationshipId: result.trustedRelationshipId,
      },
    });

    return NextResponse.json({
      status: "verified",
      message: "Approved → Added to Investigation",
      integration: result,
    });
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
