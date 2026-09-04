import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildGraphData } from "@/lib/graph/analysis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [entities, relationships, financialEntities, transactions] = await Promise.all([
    db.entity.findMany({ where: { investigationId: id } }),
    db.relationship.findMany({
      where: { investigationId: id, status: { not: "REJECTED" } },
    }),
    db.financialEntity.findMany({ where: { investigationId: id } }),
    db.transaction.findMany({ where: { investigationId: id } }),
  ]);

  const baseGraph = buildGraphData(entities, relationships);

  // Append financial nodes
  financialEntities.forEach((fe) => {
    baseGraph.nodes.push({
      id: fe.id,
      label: fe.label,
      type: fe.type as any,
    });
  });

  // Append transaction edges
  transactions.forEach((tx) => {
    baseGraph.links.push({
      id: tx.id,
      source: tx.senderFinancialEntityId,
      target: tx.receiverFinancialEntityId,
      type: tx.channel,
      status: "VERIFIED" as any,
      confidence: 1.0,
    });
  });

  return NextResponse.json(baseGraph);
}
