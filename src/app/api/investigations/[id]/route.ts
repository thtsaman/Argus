import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InvestigationStatus } from "@prisma/client";

// GET /api/investigations/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const investigation = await db.investigation.findUnique({
      where: { id },
      include: {
        lead: { select: { name: true } },
        _count: {
          select: {
            entities: true,
            relationships: true,
            evidence: true,
          },
        },
      },
    });

    if (!investigation) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    return NextResponse.json(investigation);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch investigation" },
      { status: 500 }
    );
  }
}

// PATCH /api/investigations/[id] - Edit metadata or update status (Archive/Restore)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, startDate, endDate, status } = body;

    const existing = await db.investigation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (title !== undefined) {
      if (!title || typeof title !== "string" || !title.trim()) {
        return NextResponse.json({ error: "Investigation Name cannot be empty" }, { status: 400 });
      }
      dataToUpdate.title = title.trim();
    }

    if (description !== undefined) {
      if (!description || typeof description !== "string" || !description.trim()) {
        return NextResponse.json({ error: "Description cannot be empty" }, { status: 400 });
      }
      dataToUpdate.description = description.trim();
    }

    if (startDate !== undefined) {
      dataToUpdate.startDate = startDate ? new Date(startDate) : null;
    }

    if (endDate !== undefined) {
      dataToUpdate.endDate = endDate ? new Date(endDate) : null;
    }

    const effectiveStartDate = dataToUpdate.startDate !== undefined ? dataToUpdate.startDate : existing.startDate;
    const effectiveEndDate = dataToUpdate.endDate !== undefined ? dataToUpdate.endDate : existing.endDate;

    if (effectiveStartDate && effectiveEndDate && effectiveEndDate < effectiveStartDate) {
      return NextResponse.json(
        { error: "End Date cannot be earlier than Start Date" },
        { status: 400 }
      );
    }

    if (status !== undefined) {
      if (Object.values(InvestigationStatus).includes(status as InvestigationStatus)) {
        dataToUpdate.status = status as InvestigationStatus;
      } else {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
    }

    const updated = await db.investigation.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update investigation" },
      { status: 500 }
    );
  }
}

// DELETE /api/investigations/[id] - Scope-delete investigation and dependent data
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.investigation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    // Prisma relation cascading handles:
    // Entity (and its aliases/relations)
    // Location
    // Event (and eventEvidence)
    // EvidenceItem (and candidates/relationshipEvidence)
    // Relationship
    // CandidateFinding
    // AIInsight
    // Conversation (and ChatMessage)
    // We execute in a transaction for safety
    await db.$transaction(async (tx) => {
      await tx.investigation.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true, message: "Investigation deleted successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete investigation" },
      { status: 500 }
    );
  }
}
