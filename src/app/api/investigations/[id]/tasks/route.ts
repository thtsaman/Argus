import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("investigation:read");
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const entityId = searchParams.get("entityId");
    const leadId = searchParams.get("leadId");

    const where: any = { investigationId: id };
    if (status && status !== "ALL") where.status = status;
    if (priority && priority !== "ALL") where.priority = priority;
    if (entityId) where.entityId = entityId;
    if (leadId) where.leadId = leadId;

    const tasks = await db.investigationTask.findMany({
      where,
      orderBy: [
        { priority: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        entity: { select: { id: true, label: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        parentTask: { select: { id: true, title: true } },
      },
    });

    // Also fetch associated evidence & relationship metadata manually if referenced
    const enrichedTasks = await Promise.all(
      tasks.map(async (task: any) => {
        let evidence = null;
        let relationship = null;
        if (task.evidenceId) {
          evidence = await db.evidenceItem.findUnique({
            where: { id: task.evidenceId },
            select: { id: true, title: true, type: true },
          });
        }
        if (task.relationshipId) {
          relationship = await db.relationship.findUnique({
            where: { id: task.relationshipId },
            include: {
              source: { select: { id: true, label: true } },
              target: { select: { id: true, label: true } },
            },
          });
        }
        return {
          ...task,
          evidence,
          relationship,
        };
      })
    );

    return NextResponse.json({ tasks: enrichedTasks });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch investigation tasks" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("investigation:write");
    const { id } = await params;
    const body = await req.json();

    const {
      title,
      description,
      whyItMatters,
      priority,
      status,
      sourceType,
      expectedOutcome,
      entityId,
      relationshipId,
      evidenceId,
      leadId,
      eventId,
      parentTaskId,
      dueDate,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Task description (What) is required" }, { status: 400 });
    }

    // Check duplicate: prevent creating identical open/in_progress task for same entity/title/lead
    if (entityId || leadId || relationshipId) {
      const existing = await db.investigationTask.findFirst({
        where: {
          investigationId: id,
          title: title.trim(),
          status: { in: ["OPEN", "IN_PROGRESS"] },
          OR: [
            entityId ? { entityId } : {},
            leadId ? { leadId } : {},
            relationshipId ? { relationshipId } : {},
          ],
        },
      });

      if (existing) {
        return NextResponse.json(
          { task: existing, duplicate: true, message: "An equivalent open task already exists." },
          { status: 200 }
        );
      }
    }

    const task = await db.investigationTask.create({
      data: {
        investigationId: id,
        title: title.trim(),
        description: description.trim(),
        whyItMatters: whyItMatters?.trim() || null,
        priority: priority || "MEDIUM",
        status: status || "OPEN",
        sourceType: sourceType || "INVESTIGATOR_CREATED",
        expectedOutcome: expectedOutcome?.trim() || null,
        entityId: entityId || null,
        relationshipId: relationshipId || null,
        evidenceId: evidenceId || null,
        leadId: leadId || null,
        eventId: eventId || null,
        parentTaskId: parentTaskId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: user.id,
      },
      include: {
        entity: { select: { id: true, label: true, type: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "INVESTIGATION_UPDATED",
      resourceType: "InvestigationTask",
      resourceId: task.id,
      metadata: { action: "CREATE_TASK", title: task.title },
    });

    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create investigation task" },
      { status: 500 }
    );
  }
}
