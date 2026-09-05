import { NextResponse } from "next/server";
import { issueIntegrityRecord } from "@/lib/integrity/service";
import { requirePermission, AuthError } from "@/lib/auth/permissions";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("investigation:write");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const { pdfBase64, documentName } = body;
    if (!pdfBase64) {
      return NextResponse.json({ error: "pdfBase64 is required" }, { status: 400 });
    }

    // Convert Base64 data URL string to Buffer
    const base64Clean = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(base64Clean, "base64");

    const record = await issueIntegrityRecord({
      investigationId: id,
      pdfBuffer,
      documentName: documentName || "Investigation Brief PDF",
    });

    return NextResponse.json({
      success: true,
      integrityRecord: record,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to issue integrity record" }, { status: 500 });
  }
}
