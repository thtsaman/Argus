import { createHash } from "crypto";
import { AuditAction, Prisma } from "@prisma/client";
import { db } from "../db";

export async function createAuditLog(params: {
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  const lastLog = await db.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { currentHash: true },
  });

  const previousHash = lastLog?.currentHash ?? "GENESIS";
  const payload = JSON.stringify({
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    metadata: params.metadata,
    previousHash,
    timestamp: new Date().toISOString(),
  });

  const currentHash = createHash("sha256").update(payload).digest("hex");

  return db.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      previousHash,
      currentHash,
    },
  });
}

export async function verifyAuditChain(): Promise<{
  valid: boolean;
  totalRecords: number;
  brokenAt?: number;
  message: string;
}> {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (logs.length === 0) {
    return { valid: true, totalRecords: 0, message: "No audit records to verify" };
  }

  let expectedPrevious = "GENESIS";

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    if (log.previousHash !== expectedPrevious) {
      return {
        valid: false,
        totalRecords: logs.length,
        brokenAt: i,
        message: `Chain broken at record ${i + 1}: previousHash mismatch`,
      };
    }

    const payload = JSON.stringify({
      userId: log.userId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      metadata: log.metadata,
      previousHash: log.previousHash,
      timestamp: log.createdAt.toISOString(),
    });

    const expectedHash = createHash("sha256").update(payload).digest("hex");

    if (log.currentHash !== expectedHash) {
      return {
        valid: false,
        totalRecords: logs.length,
        brokenAt: i,
        message: `Chain broken at record ${i + 1}: currentHash mismatch (possible tampering)`,
      };
    }

    expectedPrevious = log.currentHash;
  }

  return {
    valid: true,
    totalRecords: logs.length,
    message: `Audit chain verified: ${logs.length} records intact`,
  };
}
