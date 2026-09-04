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

    const fromId = searchParams.get("from");
    const toId = searchParams.get("to");
    const nodeKey = searchParams.get("nodeKey");
    const direction = searchParams.get("direction"); // "forward" | "back"

    // Fetch all transactions for investigation graph traversal
    const allTransactions = await db.transaction.findMany({
      where: { investigationId: id },
      include: {
        sender: true,
        receiver: true,
        sourceEvidence: { select: { id: true, title: true } },
      },
      orderBy: { timestamp: "asc" },
    });

    const allEntities = await db.financialEntity.findMany({
      where: { investigationId: id },
      include: { linkedEntity: { select: { id: true, label: true, type: true } } },
    });

    const entityMap = new Map(allEntities.map((e) => [e.id, e]));
    const identifierMap = new Map(allEntities.map((e) => [e.identifier, e]));

    // Resolve starting financial entity
    let startFe = fromId ? (entityMap.get(fromId) || identifierMap.get(fromId)) : null;
    let endFe = toId ? (entityMap.get(toId) || identifierMap.get(toId)) : null;

    if (nodeKey && !startFe) {
      startFe = entityMap.get(nodeKey) || identifierMap.get(nodeKey);
    }

    let resultNodes: any[] = [];
    let resultEdges: any[] = [];

    if (startFe && endFe) {
      // Find direct or 1-3 hop path between startFe and endFe
      const pathTx: any[] = [];
      const queue: { currentId: string; path: any[] }[] = [{ currentId: startFe.id, path: [] }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { currentId, path } = queue.shift()!;
        if (currentId === endFe.id) {
          pathTx.push(...path);
          break;
        }
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const outgoing = allTransactions.filter((t) => t.senderFinancialEntityId === currentId);
        for (const tx of outgoing) {
          queue.push({
            currentId: tx.receiverFinancialEntityId,
            path: [...path, tx],
          });
        }
      }

      resultEdges = pathTx;
      const nodeIds = new Set<string>();
      pathTx.forEach((tx) => {
        nodeIds.add(tx.senderFinancialEntityId);
        nodeIds.add(tx.receiverFinancialEntityId);
      });
      resultNodes = Array.from(nodeIds).map((feId) => entityMap.get(feId)).filter(Boolean);

      await createAuditLog({
        action: "FINANCIAL_PATH_ANALYSIS",
        resourceType: "Investigation",
        resourceId: id,
        metadata: { from: startFe.identifier, to: endFe.identifier, hops: pathTx.length },
      });
    } else if (startFe) {
      // Trace Forward or Trace Back from startFe
      const isBack = direction === "back";
      const txs = isBack
        ? allTransactions.filter((t) => t.receiverFinancialEntityId === startFe.id)
        : allTransactions.filter((t) => t.senderFinancialEntityId === startFe.id);

      resultEdges = txs;
      const nodeIds = new Set<string>([startFe.id]);
      txs.forEach((tx) => {
        nodeIds.add(tx.senderFinancialEntityId);
        nodeIds.add(tx.receiverFinancialEntityId);
      });
      resultNodes = Array.from(nodeIds).map((feId) => entityMap.get(feId)).filter(Boolean);

      await createAuditLog({
        action: "FINANCIAL_TRACE",
        resourceType: "Investigation",
        resourceId: id,
        metadata: { node: startFe.identifier, direction: direction || "forward", txCount: txs.length },
      });
    }

    return NextResponse.json({
      nodes: resultNodes,
      edges: resultEdges,
      startNode: startFe,
      endNode: endFe,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze financial path" },
      { status: 500 }
    );
  }
}
