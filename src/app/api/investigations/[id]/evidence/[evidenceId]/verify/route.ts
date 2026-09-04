import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { sha256 } from "@/lib/crypto";
import { verifyEvidence } from "@/lib/blockchain";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  try {
    await requirePermission("evidence:read");
    const { id, evidenceId } = await params;
    const evidence = await db.evidenceItem.findFirst({
      where: { id: evidenceId, investigationId: id },
      select: { id: true, filePath: true, blockchainHash: true },
    });

    if (!evidence) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    if (!evidence.filePath) {
      return NextResponse.json({ error: "Original evidence file is unavailable" }, { status: 409 });
    }
    if (!evidence.blockchainHash) {
      return NextResponse.json({
        evidenceId,
        currentHash: null,
        blockchainHash: null,
        status: "NOT_ANCHORED",
      }, { status: 409 });
    }

    const currentHash = `0x${sha256(await readFile(evidence.filePath))}`;
    const result = await verifyEvidence({ evidenceId, currentHash });
    return NextResponse.json({
      evidenceId,
      currentHash,
      blockchainHash: result.anchoredHash,
      status: result.status,
      anchored: result.anchored,
      verified: result.verified,
    }, { status: result.status === "NOT_ANCHORED" ? 409 : 200 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Unable to verify evidence integrity right now" }, { status: 502 });
  }
}