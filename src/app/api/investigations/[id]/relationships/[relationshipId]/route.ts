import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { RelationshipStatus } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; relationshipId: string }> }
) {
  try {
    const user = await requirePermission("relationship:verify");
    const { id, relationshipId } = await params;
    const body = await req.json();

    const action: "verify" | "reject" | "under_review" = body.action;
    if (!action || !["verify", "reject", "under_review"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const relationship = await db.relationship.findFirst({
      where: { id: relationshipId, investigationId: id },
    });

    if (!relationship) {
      return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
    }

    let newStatus: RelationshipStatus = RelationshipStatus.UNDER_REVIEW;
    let auditAction: "RELATIONSHIP_VERIFIED" | "RELATIONSHIP_REJECTED" | "RELATIONSHIP_CREATED" = "RELATIONSHIP_VERIFIED";

    if (action === "verify") {
      newStatus = RelationshipStatus.VERIFIED;
      auditAction = "RELATIONSHIP_VERIFIED";
    } else if (action === "reject") {
      newStatus = RelationshipStatus.REJECTED;
      auditAction = "RELATIONSHIP_REJECTED";
    } else {
      newStatus = RelationshipStatus.UNDER_REVIEW;
    }

    const updated = await db.relationship.update({
      where: { id: relationshipId },
      data: {
        status: newStatus,
        verifiedAt: action === "verify" ? new Date() : null,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: auditAction,
      resourceType: "Relationship",
      resourceId: relationshipId,
      metadata: { action, previousStatus: relationship.status, newStatus, note: body.note },
    });

    return NextResponse.json({ relationship: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update relationship" },
      { status: 500 }
    );
  }
}
