import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { z } from "zod";

const updateCandidateSchema = z.object({
  label: z.string().optional(),
  description: z.string().nullable().optional(),
  type: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const user = await requirePermission("relationship:verify");
    const { id, candidateId } = await params;
    const body = await req.json();
    const parsed = updateCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid edit payload" }, { status: 400 });
    }

    const candidate = await db.candidateFinding.findFirst({
      where: { id: candidateId, investigationId: id },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const updatedData = parsed.data.data
      ? ({ ...(candidate.data as object), ...parsed.data.data } as any)
      : (candidate.data as any);

    const updated = await db.candidateFinding.update({
      where: { id: candidateId },
      data: {
        ...(parsed.data.label ? { label: parsed.data.label } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.type ? { type: parsed.data.type as any } : {}),
        data: updatedData,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CANDIDATE_VERIFIED",
      resourceType: "CandidateFinding",
      resourceId: candidateId,
      metadata: { previousLabel: candidate.label, updatedLabel: updated.label, actionType: "EDIT" },
    });

    return NextResponse.json({ candidate: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Edit failed" },
      { status: 500 }
    );
  }
}
