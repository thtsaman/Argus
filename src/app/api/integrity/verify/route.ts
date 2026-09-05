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
      return NextResponse.json({ error: "PDF file is required for verification" }, { status: 400 });
    }

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    if (!isPdf) {
      return NextResponse.json({ error: "Invalid file type. Only PDF documents are allowed." }, { status: 400 });
    }

    // Maximum 25MB file size check
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds maximum size limit (25MB)" }, { status: 400 });
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
  } catch {
    return NextResponse.json({ error: "Failed to process document verification" }, { status: 500 });
  }
}
