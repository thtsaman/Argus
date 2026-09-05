import { NextResponse } from "next/server";
import { verifyIntegrityByFile } from "@/lib/integrity/service";
import { createAuditLog } from "@/lib/audit/chain";
import { AuditAction } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const integrityId = (formData.get("integrityId") as string) || undefined;

    if (!file) {
      console.warn("[VERIFY ERROR] No file provided in formData");
      return NextResponse.json({ error: "PDF file is required for verification" }, { status: 400 });
    }

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf" || file.type === "application/octet-stream";
    if (!isPdf) {
      console.warn("[VERIFY ERROR] File is not PDF:", { name: file.name, type: file.type });
      return NextResponse.json({ error: `Invalid file type (${file.type}). Only PDF documents are allowed.` }, { status: 400 });
    }

    // Maximum 100MB file size check
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds maximum size limit (100MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Compute SHA-256 server-side (never trust client hash)
    const result = await verifyIntegrityByFile(pdfBuffer, integrityId);

    // Log verification event in audit chain
    await createAuditLog({
      action: result.match
        ? AuditAction.DOCUMENT_VERIFICATION_SUCCEEDED
        : AuditAction.DOCUMENT_VERIFICATION_FAILED,
      resourceType: "DocumentVerification",
      resourceId: result.issuedRecord?.integrityId || "UNKNOWN",
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        receivedHash: result.receivedHash,
        status: result.status,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[VERIFY API EXCEPTION]", err);
    return NextResponse.json({ error: "Failed to process document verification: " + (err?.message || "Unknown error") }, { status: 500 });
  }
}
