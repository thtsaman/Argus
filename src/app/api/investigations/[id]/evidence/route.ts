import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/chain";
import { extractTextFromFile, detectMimeType, parseCSV, parseJSON } from "@/lib/evidence/parser";
import { extractFromText } from "@/lib/ai/provider";
import { EntityType, RelationshipType } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("evidence:upload");
    const { id } = await params;
    const formData = await req.formData();

    const title = (formData.get("title") as string) || "Uploaded evidence";
    const pasteText = formData.get("pasteText") as string | null;
    const file = formData.get("file") as File | null;

    let content = pasteText || "";
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let filePath: string | undefined;

    if (file) {
      fileName = file.name;
      mimeType = file.type || detectMimeType(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      content = await extractTextFromFile(buffer, mimeType, file.name);

      const uploadDir = path.join(process.cwd(), "uploads", id);
      await mkdir(uploadDir, { recursive: true });
      filePath = path.join(uploadDir, file.name);
      await writeFile(filePath, buffer);
    }

    if (!content) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const evidence = await db.evidenceItem.create({
      data: {
        investigationId: id,
        title,
        fileName,
        mimeType,
        filePath,
        rawContent: content,
        normalizedContent: content,
        status: "PROCESSING",
        type: mimeType?.includes("json") || mimeType?.includes("csv") ? "STRUCTURED_DATA" : "DOCUMENT",
      },
    });

    let candidatesCreated = 0;

    if (mimeType?.includes("csv") || fileName?.endsWith(".csv")) {
      const records = parseCSV(content);
      for (const record of records.slice(0, 20)) {
        await db.candidateFinding.create({
          data: {
            investigationId: id,
            evidenceId: evidence.id,
            type: record.type === "relationship" ? "RELATIONSHIP" : record.type === "event" ? "EVENT" : "ENTITY",
            label: Object.values(record.data).slice(0, 2).join(" — "),
            data: record.data,
            sourceExcerpt: JSON.stringify(record.data).slice(0, 200),
            confidence: 0.9,
          },
        });
        candidatesCreated++;
      }
    } else if (mimeType?.includes("json") || fileName?.endsWith(".json")) {
      const records = parseJSON(content);
      for (const record of records.slice(0, 20)) {
        await db.candidateFinding.create({
          data: {
            investigationId: id,
            evidenceId: evidence.id,
            type: record.type === "relationship" ? "RELATIONSHIP" : record.type === "event" ? "EVENT" : "ENTITY",
            label: Object.values(record.data).slice(0, 2).join(" — "),
            data: record.data,
            sourceExcerpt: JSON.stringify(record.data).slice(0, 200),
            confidence: 0.9,
          },
        });
        candidatesCreated++;
      }
    } else {
      const { result, flags, error } = await extractFromText(content);
      if (result) {
        for (const entity of result.entities.slice(0, 10)) {
          await db.candidateFinding.create({
            data: {
              investigationId: id,
              evidenceId: evidence.id,
              type: "ENTITY",
              label: entity.label,
              description: entity.description,
              data: { type: entity.type, label: entity.label },
              sourceExcerpt: content.slice(0, 200),
              confidence: 0.6,
            },
          });
          candidatesCreated++;
        }
        for (const rel of result.relationships.slice(0, 10)) {
          await db.candidateFinding.create({
            data: {
              investigationId: id,
              evidenceId: evidence.id,
              type: "RELATIONSHIP",
              label: `${rel.source} → ${rel.target}`,
              data: rel,
              sourceExcerpt: content.slice(0, 200),
              confidence: rel.confidence ?? 0.5,
            },
          });
          candidatesCreated++;
        }
        for (const event of result.events.slice(0, 10)) {
          await db.candidateFinding.create({
            data: {
              investigationId: id,
              evidenceId: evidence.id,
              type: "EVENT",
              label: event.title,
              description: event.description,
              data: event,
              sourceExcerpt: content.slice(0, 200),
              confidence: 0.55,
            },
          });
          candidatesCreated++;
        }
      }
      if (flags.length > 0) {
        await db.evidenceItem.update({
          where: { id: evidence.id },
          data: { metadata: { injectionFlags: flags, extractionError: error } },
        });
      }
    }

    await db.evidenceItem.update({
      where: { id: evidence.id },
      data: { status: "EXTRACTED", processedAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      action: "EVIDENCE_CREATED",
      resourceType: "EvidenceItem",
      resourceId: evidence.id,
      metadata: { title, candidatesCreated },
    });

    return NextResponse.json({ evidence, candidatesCreated });
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
