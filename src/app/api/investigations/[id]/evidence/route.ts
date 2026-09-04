import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { CandidateType } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { extractTextFromFile, detectMimeType } from "@/lib/evidence/parser";
import { extractFromText } from "@/lib/ai/provider";
import { APP_CONFIG } from "@/lib/config";
import { sha256 } from "@/lib/crypto";
import { anchorEvidence } from "@/lib/blockchain";

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

        // GenAI Extraction Step (Batch 11 Pipeline)
        let extractionFlags: string[] = [];
        let extractionError: string | undefined = undefined;

        if (preparedContent && preparedContent.trim()) {
          const { result: extracted, flags, error: aiError } = await extractFromText(preparedContent);
          extractionFlags = flags;
          extractionError = aiError;

          if (extracted) {
            // Save Extracted Entities
            const validCandidateTypes = new Set(["ENTITY", "EVENT", "RELATIONSHIP", "LOCATION", "VEHICLE", "ORGANIZATION", "ACCOUNT", "PHONE", "PERSON"]);
            for (const entity of extracted.entities) {
              const entityTypeUpper = (entity.type || "").toUpperCase();
              // If type is PERSON, maps to ENTITY or PERSON depending on enum, CandidateType has ENTITY, EVENT, RELATIONSHIP, LOCATION, VEHICLE, ORGANIZATION, ACCOUNT, PHONE
              // Note: CandidateType enum contains: ENTITY, EVENT, RELATIONSHIP, LOCATION, VEHICLE, ORGANIZATION, ACCOUNT, PHONE
              // 'PERSON' is not in CandidateType enum! It maps to 'ENTITY' or 'PERSON' if in enum.
              let candidateType: CandidateType = "ENTITY";
              if (validCandidateTypes.has(entityTypeUpper) && entityTypeUpper !== "PERSON") {
                candidateType = entityTypeUpper as CandidateType;
              }

              await db.candidateFinding.create({
                data: {
                  investigationId: id,
                  evidenceId: evidenceRecord.id,
                  type: candidateType,
                  status: "PENDING",
                  label: entity.name,
                  description: entity.aliases?.length ? `Aliases: ${entity.aliases.join(", ")}` : null,
                  sourceExcerpt: entity.excerpt || preparedContent.slice(0, 300),
                  data: {
                    type: entity.type,
                    label: entity.name,
                    aliases: entity.aliases || [],
                    identifiers: entity.identifiers || [],
                    sourceReference: originalFileName,
                  },
                },
              });
            }

            // Save Extracted Relationships
            for (const rel of extracted.relationships) {
              await db.candidateFinding.create({
                data: {
                  investigationId: id,
                  evidenceId: evidenceRecord.id,
                  type: "RELATIONSHIP",
                  status: "PENDING",
                  label: `${rel.source} → ${rel.target}`,
                  description: rel.explanation || `ARGUS identified this relationship because the source document explicitly states a ${rel.type} link.`,
                  confidence: rel.confidence ?? 0.85,
                  sourceExcerpt: rel.excerpt || preparedContent.slice(0, 300),
                  data: {
                    source: rel.source,
                    target: rel.target,
                    type: rel.type,
                    explanation: rel.explanation || `Explicitly stated in ${originalFileName}: ${rel.excerpt || rel.type}`,
                    sourceReference: originalFileName,
                  },
                },
              });
            }

            // Save Extracted Events
            for (const evt of extracted.events) {
              await db.candidateFinding.create({
                data: {
                  investigationId: id,
                  evidenceId: evidenceRecord.id,
                  type: "EVENT",
                  status: "PENDING",
                  label: evt.title,
                  description: evt.description || null,
                  sourceExcerpt: evt.excerpt || preparedContent.slice(0, 300),
                  data: {
                    title: evt.title,
                    date: evt.date || null,
                    location: evt.location || null,
                    entitiesInvolved: evt.entitiesInvolved || [],
                    sourceReference: originalFileName,
                  },
                },
              });
            }

            // Save Extracted Locations
            for (const loc of extracted.locations) {
              await db.candidateFinding.create({
                data: {
                  investigationId: id,
                  evidenceId: evidenceRecord.id,
                  type: "LOCATION",
                  status: "PENDING",
                  label: loc.name,
                  description: [loc.address, loc.city, loc.state, loc.country].filter(Boolean).join(", ") || null,
                  sourceExcerpt: loc.excerpt || preparedContent.slice(0, 300),
                  data: {
                    name: loc.name,
                    address: loc.address || null,
                    city: loc.city || null,
                    state: loc.state || null,
                    country: loc.country || null,
                    sourceReference: originalFileName,
                  },
                },
              });
            }
          }
        }

        // Update evidence item to READY / EXTRACTED state
        await db.evidenceItem.update({
          where: { id: evidenceRecord.id },
          data: {
            filePath,
            rawContent: preparedContent,
            normalizedContent: preparedContent,
            status: "EXTRACTED", // Maps to READY state in ingestion workflow
            processedAt: new Date(),
            metadata: {
              fileSize: file.size,
              uploadedBy: user.email,
              extractionFlags,
              extractionError: extractionError || null,
            },
          },
        });

        const blockchainHash = `0x${sha256(buffer)}`;
        let blockchainRecord = await db.evidenceItem.update({
          where: { id: evidenceRecord.id },
          data: { blockchainHash, blockchainStatus: "PENDING" },
        });
        let blockchainWarning: string | undefined;

        try {
          const anchor = await anchorEvidence({
            evidenceId: evidenceRecord.id,
            evidenceHash: blockchainHash,
            agencyId: "KOLKATA_POLICE",
          });
          blockchainRecord = await db.evidenceItem.update({
            where: { id: evidenceRecord.id },
            data: {
              blockchainStatus: "ANCHORED",
              blockchainHash,
              blockchainTxHash: anchor.txHash,
              blockchainBlock: anchor.blockNumber,
              blockchainAnchoredAt: new Date(),
            },
          });
        } catch (blockchainError) {
          blockchainWarning = blockchainError instanceof Error
            ? blockchainError.message
            : "Blockchain anchoring failed";
          blockchainRecord = await db.evidenceItem.update({
            where: { id: evidenceRecord.id },
            data: { blockchainStatus: "FAILED", blockchainHash },
          });
        }

        await createAuditLog({
          userId: user.id,
          action: "EVIDENCE_CREATED",
          resourceType: "EvidenceItem",
          resourceId: evidenceRecord.id,
          metadata: { fileName: originalFileName, fileSize: file.size },
        });

        results.push({
          id: blockchainRecord.id,
          fileName: originalFileName,
          status: "READY",
          size: file.size,
          blockchain: {
            status: blockchainRecord.blockchainStatus,
            hash: blockchainRecord.blockchainHash,
            warning: blockchainWarning,
          },
          record: blockchainRecord,
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
