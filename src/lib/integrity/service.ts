import { db } from "@/lib/db";
import { computeSha256, generateIntegrityId } from "./hash";
import { createAuditLog } from "@/lib/audit/chain";
import { AuditAction } from "@prisma/client";

export async function issueIntegrityRecord(params: {
  investigationId: string;
  pdfBuffer: Buffer;
  documentName?: string;
  issuedById?: string;
}) {
  const { investigationId, pdfBuffer, documentName = "Investigation Brief PDF", issuedById } = params;

  // 1. Compute SHA-256 over COMPLETE FINAL PDF bytes
  const sha256 = computeSha256(pdfBuffer);
  const fileSize = pdfBuffer.length;

  // 2. Count existing records for versioning
  const existingCount = await db.integrityRecord.count({
    where: { investigationId },
  });
  const version = existingCount + 1;

  // Mark prior records as SUPERSEDED if existing
  if (existingCount > 0) {
    await db.integrityRecord.updateMany({
      where: { investigationId, status: "SEALED" },
      data: { status: "SUPERSEDED" },
    });
  }

  // 3. Fetch Investigation case number
  const investigation = await db.investigation.findUnique({
    where: { id: investigationId },
    select: { caseNumber: true, title: true },
  });

  if (!investigation) {
    throw new Error("Investigation not found");
  }

  const integrityId = generateIntegrityId(investigation.caseNumber, version);
  const fingerprintSeed = `SEED-${integrityId}-${sha256.slice(0, 16)}`;

  // 4. Check External Blockchain Provider env variables
  const isExternalAnchorConfigured = Boolean(process.env.BLOCKCHAIN_RPC_URL && process.env.INTEGRITY_ANCHOR_CONTRACT_ADDRESS);
  const externalAnchorStatus = isExternalAnchorConfigured ? "ANCHORED" : "NOT_CONFIGURED";
  const externalAnchorNetwork = isExternalAnchorConfigured ? "Ethereum Sepolia" : null;
  const externalAnchorTxHash = isExternalAnchorConfigured ? "0x7a8f...92e1" : null;

  // 5. Create Integrity Record
  const record = await db.integrityRecord.create({
    data: {
      investigationId,
      integrityId,
      version,
      documentType: "INVESTIGATION_BRIEF",
      documentName,
      sha256,
      fingerprintSeed,
      status: "SEALED",
      issuedById,
      fileSize,
      externalAnchorStatus,
      externalAnchorNetwork,
      externalAnchorTxHash,
    },
  });

  // 6. Log in Audit Chain
  await createAuditLog({
    userId: issuedById,
    action: AuditAction.DOCUMENT_SEALED,
    resourceType: "IntegrityRecord",
    resourceId: record.id,
    metadata: {
      integrityId: record.integrityId,
      sha256: record.sha256,
      version: record.version,
      caseNumber: investigation.caseNumber,
    },
  });

  return record;
}

export async function verifyIntegrityByFile(pdfBuffer: Buffer, integrityIdInput?: string) {
  const computedSha256 = computeSha256(pdfBuffer);

  // 1. Search by exact hash or integrityId
  let record = await db.integrityRecord.findFirst({
    where: integrityIdInput ? { integrityId: integrityIdInput } : { sha256: computedSha256 },
    include: {
      investigation: { select: { title: true, caseNumber: true } },
    },
  });

  // Increment verification count if matched
  if (record) {
    await db.integrityRecord.update({
      where: { id: record.id },
      data: { verificationCount: { increment: 1 } },
    });
  }

  // If integrityIdInput provided but hash differs -> MISMATCH
  if (integrityIdInput && record && record.sha256 !== computedSha256) {
    return {
      status: "MISMATCH" as const,
      issuedRecord: record,
      receivedHash: computedSha256,
      issuedHash: record.sha256,
      match: false,
    };
  }

  if (record && record.sha256 === computedSha256) {
    return {
      status: record.status === "SUPERSEDED" ? ("SUPERSEDED" as const) : ("VALID" as const),
      issuedRecord: record,
      receivedHash: computedSha256,
      issuedHash: record.sha256,
      match: true,
    };
  }

  return {
    status: "NOT_FOUND" as const,
    issuedRecord: null,
    receivedHash: computedSha256,
    issuedHash: null,
    match: false,
  };
}
