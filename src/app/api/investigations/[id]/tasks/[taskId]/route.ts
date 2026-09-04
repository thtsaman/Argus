import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    await requirePermission("investigation:read");
    const { id, taskId } = await params;

    const task = await db.investigationTask.findFirst({
      where: { id: taskId, investigationId: id },
      include: {
        entity: { select: { id: true, label: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    let evidence = null;
    let relationship = null;

    if (task.evidenceId) {
      evidence = await db.evidenceItem.findUnique({
        where: { id: task.evidenceId },
        select: { id: true, title: true, type: true, source: true },
      });
    }

    if (task.relationshipId) {
      relationship = await db.relationship.findUnique({
        where: { id: task.relationshipId },
        include: {
          source: { select: { id: true, label: true, type: true } },
          target: { select: { id: true, label: true, type: true } },
        },
      });
    }

    return NextResponse.json({ task: { ...task, evidence, relationship } });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const user = await requirePermission("investigation:write");
    const { id, taskId } = await params;
    const body = await req.json();

    const existingTask = await db.investigationTask.findFirst({
      where: { id: taskId, investigationId: id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const {
      status,
      priority,
      title,
      description,
      whyItMatters,
      expectedOutcome,
      investigatorConclusion,
      conclusionType,
    } = body;

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;
    if (priority) dataToUpdate.priority = priority;
    if (title) dataToUpdate.title = title.trim();
    if (description) dataToUpdate.description = description.trim();
    if (whyItMatters !== undefined) dataToUpdate.whyItMatters = whyItMatters;
    if (expectedOutcome !== undefined) dataToUpdate.expectedOutcome = expectedOutcome;

    // Handle lifecycle completion
    if (status === "COMPLETED") {
      if (!investigatorConclusion || !conclusionType) {
        return NextResponse.json(
          { error: "Investigator Finding and Conclusion Type are required to complete a task." },
          { status: 400 }
        );
      }
      dataToUpdate.investigatorConclusion = investigatorConclusion.trim();
      dataToUpdate.conclusionType = conclusionType;
      dataToUpdate.completedAt = new Date();
    }

    const updatedTask = await db.investigationTask.update({
      where: { id: taskId },
      data: dataToUpdate,
      include: {
        entity: { select: { id: true, label: true, type: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "INVESTIGATION_UPDATED",
      resourceType: "InvestigationTask",
      resourceId: taskId,
      metadata: { action: "UPDATE_TASK", status: updatedTask.status, conclusionType: updatedTask.conclusionType },
    });

    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 500 }
    );
  }
}
