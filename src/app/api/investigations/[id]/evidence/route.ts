import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { extractTextFromFile, detectMimeType } from "@/lib/evidence/parser";
import { APP_CONFIG } from "@/lib/config";

// Sanitizes filename to prevent path traversal & safe storage
function sanitizeFilename(name: string): string {
  const basename = path.basename(name);
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evidenceItems = await db.evidenceItem.findMany({
      where: { investigationId: id },
      orderBy: { uploadedAt: "desc" },
    });
    return NextResponse.json({ evidence: evidenceItems });
  } catch {
    return NextResponse.json({ error: "Failed to load evidence library" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("evidence:upload");
    const { id } = await params;

    // Validate investigation exists
    const investigation = await db.investigation.findUnique({ where: { id } });
    if (!investigation) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const pasteText = formData.get("pasteText") as string | null;

    const fileList: File[] = [];
    if (files.length > 0) {
      fileList.push(...files);
    } else if (singleFile) {
      fileList.push(singleFile);
    }

    // Handle paste text input as a virtual text file
    if (fileList.length === 0 && pasteText) {
      const virtualFile = new File([pasteText], "pasted-evidence.txt", { type: "text/plain" });
      fileList.push(virtualFile);
    }

    if (fileList.length === 0) {
      return NextResponse.json({ error: "No files or text provided for upload." }, { status: 400 });
    }

    const results = [];

    for (const file of fileList) {
      const originalFileName = file.name || "unnamed-file.txt";
      const safeName = sanitizeFilename(originalFileName);
      const ext = "." + safeName.split(".").pop()?.toLowerCase();

      // Check allowed extensions
      const allowedExts: readonly string[] = APP_CONFIG.allowedExtensions;
      if (!allowedExts.includes(ext)) {
        results.push({
          fileName: originalFileName,
          status: "FAILED",
          error: `Unsupported file type '${ext}'. Accepted formats: ${allowedExts.join(", ").toUpperCase()}`,
        });
        continue;
      }

      // Check file size
      if (file.size > APP_CONFIG.maxFileSizeBytes) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const limitMb = (APP_CONFIG.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
        results.push({
          fileName: originalFileName,
          status: "FAILED",
          error: `File size (${sizeMb} MB) exceeds maximum allowed limit of ${limitMb} MB.`,
        });
        continue;
      }

      const mimeType = detectMimeType(safeName);

      // Create initial PENDING/PROCESSING record
      const evidenceRecord = await db.evidenceItem.create({
        data: {
          investigationId: id,
          title: originalFileName,
          fileName: originalFileName,
          mimeType,
          status: "PROCESSING",
          type: mimeType.includes("csv") ? "STRUCTURED_DATA" : "DOCUMENT",
          source: "Investigator Ingestion Pipeline",
          metadata: {
            fileSize: file.size,
            uploadedBy: user.email,
          },
        },
      });

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // Secure file storage outside web root
        const uploadDir = path.join(process.cwd(), "uploads", id);
        await mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, `${evidenceRecord.id}_${safeName}`);
        await writeFile(filePath, buffer);

        // Text extraction & content preparation
        const preparedContent = await extractTextFromFile(buffer, mimeType, safeName);

        // Update evidence item to READY state
        const updatedRecord = await db.evidenceItem.update({
          where: { id: evidenceRecord.id },
          data: {
            filePath,
            rawContent: preparedContent,
            normalizedContent: preparedContent,
            status: "EXTRACTED", // Maps to READY state in ingestion workflow
            processedAt: new Date(),
          },
        });

        await createAuditLog({
          userId: user.id,
          action: "EVIDENCE_CREATED",
          resourceType: "EvidenceItem",
          resourceId: evidenceRecord.id,
          metadata: { fileName: originalFileName, fileSize: file.size },
        });

        results.push({
          id: updatedRecord.id,
          fileName: originalFileName,
          status: "READY",
          size: file.size,
          record: updatedRecord,
        });
      } catch (procErr) {
        const errorMessage = procErr instanceof Error ? procErr.message : "Processing failed";
        
        await db.evidenceItem.update({
          where: { id: evidenceRecord.id },
          data: {
            status: "PENDING", // Retained for failed review
            metadata: {
              fileSize: file.size,
              uploadedBy: user.email,
              error: errorMessage,
            },
          },
        });

        results.push({
          id: evidenceRecord.id,
          fileName: originalFileName,
          status: "FAILED",
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
