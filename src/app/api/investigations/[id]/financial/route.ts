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

    const entityId = searchParams.get("entityId");
    const financialEntityId = searchParams.get("financialEntityId");
    const incident = searchParams.get("incident");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Build transaction query filters
    const txWhere: any = { investigationId: id };
    if (incident && incident !== "ALL") txWhere.incident = incident;
    if (fromDate || toDate) {
      txWhere.timestamp = {};
      if (fromDate) txWhere.timestamp.gte = new Date(fromDate);
      if (toDate) txWhere.timestamp.lte = new Date(toDate);
    }

    if (financialEntityId) {
      txWhere.OR = [
        { senderFinancialEntityId: financialEntityId },
        { receiverFinancialEntityId: financialEntityId },
      ];
    } else if (entityId) {
      // Find financial entities linked to this Person entity
      const linkedFes = await db.financialEntity.findMany({
        where: { investigationId: id, linkedEntityId: entityId },
        select: { id: true },
      });
      const feIds = linkedFes.map((f) => f.id);
      if (feIds.length > 0) {
        txWhere.OR = [
          { senderFinancialEntityId: { in: feIds } },
          { receiverFinancialEntityId: { in: feIds } },
        ];
      }
    }

    const [financialEntities, transactions, candidates] = await Promise.all([
      db.financialEntity.findMany({
        where: { investigationId: id },
        include: {
          linkedEntity: { select: { id: true, label: true, type: true } },
        },
      }),
      db.transaction.findMany({
        where: txWhere,
        orderBy: { timestamp: "desc" },
        include: {
          sender: { select: { id: true, identifier: true, label: true, type: true, attributionStatus: true, linkedEntityId: true } },
          receiver: { select: { id: true, identifier: true, label: true, type: true, attributionStatus: true, linkedEntityId: true } },
          sourceEvidence: { select: { id: true, title: true, type: true, fileName: true } },
        },
      }),
      db.candidateFinding.findMany({
        where: {
          investigationId: id,
          type: "RELATIONSHIP",
        },
        select: { id: true, label: true, description: true, sourceExcerpt: true, data: true },
      }),
    ]);

    // Filter financial signals derived from JSON seed
    const signals = candidates.filter((c: any) => c.data && c.data.signalKey);

    // Calculate totals
    const totalReceived = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalSent = totalReceived; // aggregate scope

    await createAuditLog({
      action: "FINANCIAL_TRACE",
      resourceType: "Investigation",
      resourceId: id,
      metadata: { txCount: transactions.length, entityId, financialEntityId },
    });

    return NextResponse.json({
      financialEntities,
      transactions,
      signals,
      summary: {
        totalReceived,
        totalSent,
        transactionCount: transactions.length,
        signalCount: signals.length,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch financial data" },
      { status: 500 }
    );
  }
}
