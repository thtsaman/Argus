import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { InvestigationStatus, AuditAction } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/chain";

// Helper to generate unique case ID: ARG-2026-XXXX
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  let unique = false;
  let caseNum = "";
  let counter = 0;

  while (!unique && counter < 100) {
    const randomFourDigit = Math.floor(1000 + Math.random() * 9000);
    caseNum = `ARG-${year}-${randomFourDigit}`;
    const existing = await db.investigation.findUnique({
      where: { caseNumber: caseNum },
      select: { id: true },
    });
    if (!existing) {
      unique = true;
    }
    counter++;
  }

  if (!unique) {
    caseNum = `ARG-${year}-${Date.now().toString().slice(-4)}`;
  }
  return caseNum;
}

// POST /api/investigations/[id]/duplicate
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: originalId } = await params;
    const body = await req.json();
    const { title, description } = body;

    // 1. Fetch source investigation
    const sourceInv = await db.investigation.findUnique({
      where: { id: originalId },
      include: {
        entities: {
          include: {
            aliases: true,
          },
        },
        locations: true,
        events: true,
        evidence: true,
        relationships: {
          include: {
            evidence: true,
          },
        },
        candidates: true,
      },
    });

    if (!sourceInv) {
      return NextResponse.json({ error: "Source investigation not found" }, { status: 404 });
    }

    const newTitle = title?.trim() || `${sourceInv.title} — Copy`;
    const newDescription = description !== undefined ? description?.trim() : sourceInv.description;
    const newCaseNumber = await generateCaseNumber();

    // Perform deep transactional duplication
    const duplicatedInv = await db.$transaction(async (tx) => {
      // Create new Investigation record
      const newInv = await tx.investigation.create({
        data: {
          title: newTitle,
          description: newDescription,
          status: InvestigationStatus.ACTIVE,
          caseNumber: newCaseNumber,
          startDate: sourceInv.startDate,
          endDate: sourceInv.endDate,
          leadId: sourceInv.leadId,
        },
      });

      // ID Mappings: Old ID -> New ID
      const entityIdMap = new Map<string, string>();
      const locationIdMap = new Map<string, string>();
      const eventIdMap = new Map<string, string>();
      const evidenceIdMap = new Map<string, string>();
      const relationshipIdMap = new Map<string, string>();

      // A. Duplicate Locations
      for (const loc of sourceInv.locations) {
        const newLoc = await tx.location.create({
          data: {
            investigationId: newInv.id,
            name: loc.name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            region: loc.region,
            address: loc.address,
          },
        });
        locationIdMap.set(loc.id, newLoc.id);
      }

      // B. Duplicate Entities (and aliases)
      for (const ent of sourceInv.entities) {
        const newEnt = await tx.entity.create({
          data: {
            investigationId: newInv.id,
            type: ent.type,
            label: ent.label,
            description: ent.description,
            metadata: ent.metadata ?? undefined,
          },
        });
        entityIdMap.set(ent.id, newEnt.id);

        for (const alias of ent.aliases) {
          await tx.entityAlias.create({
            data: {
              entityId: newEnt.id,
              alias: alias.alias,
            },
          });
        }
      }

      // C. Duplicate Evidence Items
      for (const ev of sourceInv.evidence) {
        const newEv = await tx.evidenceItem.create({
          data: {
            investigationId: newInv.id,
            title: ev.title,
            description: ev.description,
            type: ev.type,
            status: ev.status,
            source: ev.source,
            fileName: ev.fileName,
            mimeType: ev.mimeType,
            filePath: ev.filePath,
            rawContent: ev.rawContent,
            normalizedContent: ev.normalizedContent,
            metadata: ev.metadata ?? undefined,
            uploadedAt: ev.uploadedAt,
            processedAt: ev.processedAt,
          },
        });
        evidenceIdMap.set(ev.id, newEv.id);
      }

      // D. Duplicate Events
      for (const evt of sourceInv.events) {
        const newEvt = await tx.event.create({
          data: {
            investigationId: newInv.id,
            title: evt.title,
            description: evt.description,
            occurredAt: evt.occurredAt,
            entityId: evt.entityId ? entityIdMap.get(evt.entityId) ?? null : null,
            locationId: evt.locationId ? locationIdMap.get(evt.locationId) ?? null : null,
            metadata: evt.metadata ?? undefined,
          },
        });
        eventIdMap.set(evt.id, newEvt.id);
      }

      // E. Duplicate Relationships (and relationshipEvidence links)
      for (const rel of sourceInv.relationships) {
        const newSourceId = entityIdMap.get(rel.sourceId);
        const newTargetId = entityIdMap.get(rel.targetId);

        if (newSourceId && newTargetId) {
          const newRel = await tx.relationship.create({
            data: {
              investigationId: newInv.id,
              sourceId: newSourceId,
              targetId: newTargetId,
              type: rel.type,
              status: rel.status,
              confidence: rel.confidence,
              description: rel.description,
              discoveredAt: rel.discoveredAt,
              verifiedAt: rel.verifiedAt,
            },
          });
          relationshipIdMap.set(rel.id, newRel.id);

          for (const relEv of rel.evidence) {
            const newEvId = evidenceIdMap.get(relEv.evidenceId);
            if (newEvId) {
              await tx.relationshipEvidence.create({
                data: {
                  relationshipId: newRel.id,
                  evidenceId: newEvId,
                  excerpt: relEv.excerpt,
                  pageRef: relEv.pageRef,
                },
              });
            }
          }
        }
      }

      // F. Duplicate Candidate Findings
      for (const cand of sourceInv.candidates) {
        const newEvId = evidenceIdMap.get(cand.evidenceId);
        if (newEvId) {
          await tx.candidateFinding.create({
            data: {
              investigationId: newInv.id,
              evidenceId: newEvId,
              type: cand.type,
              status: cand.status,
              confidence: cand.confidence,
              label: cand.label,
              description: cand.description,
              data: cand.data ?? {},
              sourceExcerpt: cand.sourceExcerpt,
              entityId: cand.entityId ? entityIdMap.get(cand.entityId) ?? null : null,
              verifiedById: cand.verifiedById,
              verifiedAt: cand.verifiedAt,
            },
          });
        }
      }

      return newInv;
    });

    // Create Audit Log record for duplication event
    await createAuditLog({
      action: AuditAction.INVESTIGATION_UPDATED,
      resourceType: "Investigation",
      resourceId: duplicatedInv.id,
      metadata: {
        event: "DUPLICATED",
        sourceCaseNumber: sourceInv.caseNumber,
        sourceInvestigationId: sourceInv.id,
      },
    });

    return NextResponse.json(duplicatedInv, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to duplicate investigation" },
      { status: 500 }
    );
  }
}
