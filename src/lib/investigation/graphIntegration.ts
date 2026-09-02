import { db } from "@/lib/db";
import { EntityType, RelationshipType, RelationshipStatus } from "@prisma/client";

export interface IntegrationResult {
  success: boolean;
  action: "CREATED" | "MERGED" | "FLAGGED_AMBIGUOUS" | "REJECTED" | "INTEGRATED";
  trustedEntityId?: string;
  trustedRelationshipId?: string;
  trustedEventId?: string;
  trustedLocationId?: string;
  error?: string;
}

function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

function mapToEntityType(typeStr: string): EntityType {
  const upper = typeStr.toUpperCase();
  if (upper === "PERSON") return EntityType.PERSON;
  if (upper === "PHONE") return EntityType.PHONE;
  if (upper === "ACCOUNT") return EntityType.ACCOUNT;
  if (upper === "ORGANIZATION") return EntityType.ORGANIZATION;
  if (upper === "DEVICE") return EntityType.DEVICE;
  if (upper === "VEHICLE") return EntityType.VEHICLE;
  if (upper === "LOCATION") return EntityType.LOCATION;
  return EntityType.INCIDENT;
}

function mapToRelationshipType(typeStr: string): RelationshipType {
  const upper = typeStr.toUpperCase().replace(/\s+/g, "_");
  if (Object.values(RelationshipType).includes(upper as RelationshipType)) {
    return upper as RelationshipType;
  }
  if (upper.includes("COMMUNICAT") || upper.includes("CALL")) return RelationshipType.COMMUNICATED_WITH;
  if (upper.includes("TRANSACT") || upper.includes("PAY") || upper.includes("TRANSFER")) return RelationshipType.TRANSACTED_WITH;
  if (upper.includes("LOCAT") || upper.includes("AT")) return RelationshipType.LOCATED_AT;
  if (upper.includes("OWN")) return RelationshipType.OWNS;
  if (upper.includes("EMPLOY") || upper.includes("WORK")) return RelationshipType.EMPLOYED_BY;
  if (upper.includes("PARTICIPAT") || upper.includes("JOIN")) return RelationshipType.PARTICIPATED_IN;
  if (upper.includes("TRAVEL") || upper.includes("VISIT")) return RelationshipType.TRAVELED_TO;
  if (upper.includes("RELAT")) return RelationshipType.RELATED_TO;
  return RelationshipType.ASSOCIATED_WITH;
}

/**
 * Searches for an existing entity match in the investigation.
 * Returns { match: Entity, status: "EXACT" | "AMBIGUOUS" | "NONE" }
 */
export async function findEntityMatch(
  investigationId: string,
  label: string,
  type: EntityType,
  candidateData?: any
) {
  const normLabel = normalizeString(label);
  if (!normLabel) return { match: null, status: "NONE" as const };

  const existingEntities = await db.entity.findMany({
    where: { investigationId, type },
    include: { aliases: true },
  });

  const exactMatches = existingEntities.filter((e) => {
    const mainNorm = normalizeString(e.label);
    if (mainNorm === normLabel) return true;
    return e.aliases.some((a) => normalizeString(a.alias) === normLabel);
  });

  if (exactMatches.length === 1) {
    return { match: exactMatches[0], status: "EXACT" as const };
  }

  if (exactMatches.length > 1) {
    return { match: null, status: "AMBIGUOUS" as const };
  }

  // Check for ambiguous partial matches (e.g. "John Smith" vs "John", or shared identifier)
  const partialMatches = existingEntities.filter((e) => {
    const mainNorm = normalizeString(e.label);
    if (mainNorm.includes(normLabel) || normLabel.includes(mainNorm)) return true;
    return false;
  });

  if (partialMatches.length > 0) {
    return { match: null, status: "AMBIGUOUS" as const };
  }

  return { match: null, status: "NONE" as const };
}

/**
 * Integrates an approved CandidateFinding into the trusted investigation data graph.
 */
export async function integrateApprovedCandidate(
  candidateId: string,
  userId: string
): Promise<IntegrationResult> {
  const candidate = await db.candidateFinding.findUnique({
    where: { id: candidateId },
    include: { evidence: true },
  });

  if (!candidate) {
    return { success: false, action: "REJECTED", error: "Candidate finding not found" };
  }

  const investigationId = candidate.investigationId;
  const candidateData = (candidate.data as Record<string, any>) || {};
  const excerpt = candidate.sourceExcerpt || candidateData.excerpt || candidate.description || "";

  try {
    // 1. ENTITY CANDIDATES (PERSON, PHONE, ACCOUNT, ORGANIZATION, VEHICLE, DEVICE, etc.)
    if (
      ["ENTITY", "PERSON", "PHONE", "ACCOUNT", "ORGANIZATION", "VEHICLE", "DEVICE"].includes(
        candidate.type
      )
    ) {
      const entityType = mapToEntityType(candidateData.entityType || candidate.type);
      const label = candidate.label || candidateData.name || candidateData.label || "Unnamed Entity";

      const matchResult = await findEntityMatch(investigationId, label, entityType, candidateData);

      if (matchResult.status === "AMBIGUOUS") {
        // Flag for manual review - create separate entity with metadata flagging
        const newEntity = await db.entity.create({
          data: {
            investigationId,
            type: entityType,
            label,
            description: candidate.description || candidateData.description,
            metadata: {
              extractedFrom: candidate.evidenceId,
              candidateId: candidate.id,
              sourceExcerpt: excerpt,
              ambiguousMatchFlag: true,
              provenance: {
                sourceEvidenceId: candidate.evidenceId,
                sourceEvidenceTitle: candidate.evidence.title,
                extractionCandidateId: candidate.id,
                sourceExcerpt: excerpt,
                approvedAt: new Date().toISOString(),
                approvedByUserId: userId,
              },
            },
          },
        });

        // Link candidate to entity
        await db.candidateFinding.update({
          where: { id: candidateId },
          data: { entityId: newEntity.id },
        });

        return {
          success: true,
          action: "FLAGGED_AMBIGUOUS",
          trustedEntityId: newEntity.id,
        };
      }

      let entityId: string;
      let action: "CREATED" | "MERGED" = "CREATED";

      if (matchResult.status === "EXACT" && matchResult.match) {
        entityId = matchResult.match.id;
        action = "MERGED";
        // Optionally update metadata provenance
        const currentMeta = (matchResult.match.metadata as Record<string, any>) || {};
        const sources = currentMeta.provenanceSources || [];
        sources.push({
          sourceEvidenceId: candidate.evidenceId,
          sourceEvidenceTitle: candidate.evidence.title,
          extractionCandidateId: candidate.id,
          sourceExcerpt: excerpt,
          approvedAt: new Date().toISOString(),
          approvedByUserId: userId,
        });

        await db.entity.update({
          where: { id: entityId },
          data: {
            metadata: {
              ...currentMeta,
              provenanceSources: sources,
            },
          },
        });
      } else {
        // Create new trusted entity
        const newEntity = await db.entity.create({
          data: {
            investigationId,
            type: entityType,
            label,
            description: candidate.description || candidateData.description,
            metadata: {
              extractedFrom: candidate.evidenceId,
              candidateId: candidate.id,
              provenance: {
                sourceEvidenceId: candidate.evidenceId,
                sourceEvidenceTitle: candidate.evidence.title,
                extractionCandidateId: candidate.id,
                sourceExcerpt: excerpt,
                approvedAt: new Date().toISOString(),
                approvedByUserId: userId,
              },
            },
          },
        });
        entityId = newEntity.id;

        // If candidate had aliases, attach them
        if (Array.isArray(candidateData.aliases)) {
          for (const aliasStr of candidateData.aliases) {
            if (aliasStr && typeof aliasStr === "string") {
              await db.entityAlias.create({
                data: {
                  entityId: newEntity.id,
                  alias: aliasStr.trim(),
                },
              });
            }
          }
        }
      }

      await db.candidateFinding.update({
        where: { id: candidateId },
        data: { entityId },
      });

      return {
        success: true,
        action,
        trustedEntityId: entityId,
      };
    }

    // 2. RELATIONSHIP CANDIDATES
    if (candidate.type === "RELATIONSHIP") {
      const sourceName = candidateData.source || candidateData.sourceLabel;
      const targetName = candidateData.target || candidateData.targetLabel;
      const relTypeStr = candidateData.relationshipType || candidateData.type || "ASSOCIATED_WITH";
      const relType = mapToRelationshipType(relTypeStr);

      if (!sourceName || !targetName) {
        return { success: false, action: "REJECTED", error: "Relationship source or target missing" };
      }

      // Resolve or create source entity
      let sourceMatch = await findEntityMatch(investigationId, sourceName, EntityType.PERSON, candidateData);
      if (!sourceMatch.match) {
        sourceMatch = await findEntityMatch(investigationId, sourceName, EntityType.ORGANIZATION, candidateData);
      }
      let sourceEntityId: string;
      if (sourceMatch.match) {
        sourceEntityId = sourceMatch.match.id;
      } else {
        const createdSource = await db.entity.create({
          data: {
            investigationId,
            type: EntityType.PERSON,
            label: sourceName,
            metadata: {
              extractedFrom: candidate.evidenceId,
              provenance: {
                sourceEvidenceId: candidate.evidenceId,
                approvedAt: new Date().toISOString(),
              },
            },
          },
        });
        sourceEntityId = createdSource.id;
      }

      // Resolve or create target entity
      let targetMatch = await findEntityMatch(investigationId, targetName, EntityType.PERSON, candidateData);
      if (!targetMatch.match) {
        targetMatch = await findEntityMatch(investigationId, targetName, EntityType.ORGANIZATION, candidateData);
      }
      let targetEntityId: string;
      if (targetMatch.match) {
        targetEntityId = targetMatch.match.id;
      } else {
        const createdTarget = await db.entity.create({
          data: {
            investigationId,
            type: EntityType.PERSON,
            label: targetName,
            metadata: {
              extractedFrom: candidate.evidenceId,
              provenance: {
                sourceEvidenceId: candidate.evidenceId,
                approvedAt: new Date().toISOString(),
              },
            },
          },
        });
        targetEntityId = createdTarget.id;
      }

      // Prevent duplicate relationship
      const existingRel = await db.relationship.findUnique({
        where: {
          sourceId_targetId_type: {
            sourceId: sourceEntityId,
            targetId: targetEntityId,
            type: relType,
          },
        },
      });

      let relId: string;
      let action: "CREATED" | "MERGED" = "CREATED";

      if (existingRel) {
        relId = existingRel.id;
        action = "MERGED";
        await db.relationship.update({
          where: { id: relId },
          data: {
            status: RelationshipStatus.VERIFIED,
            verifiedAt: new Date(),
          },
        });
      } else {
        const newRel = await db.relationship.create({
          data: {
            investigationId,
            sourceId: sourceEntityId,
            targetId: targetEntityId,
            type: relType,
            status: RelationshipStatus.VERIFIED,
            confidence: candidate.confidence || 0.9,
            description: candidate.description || candidateData.explanation || candidateData.description,
            verifiedAt: new Date(),
          },
        });
        relId = newRel.id;
      }

      // Attach evidence provenance link
      await db.relationshipEvidence.upsert({
        where: {
          relationshipId_evidenceId: {
            relationshipId: relId,
            evidenceId: candidate.evidenceId,
          },
        },
        create: {
          relationshipId: relId,
          evidenceId: candidate.evidenceId,
          excerpt,
        },
        update: {
          excerpt,
        },
      });

      return {
        success: true,
        action,
        trustedRelationshipId: relId,
      };
    }

    // 3. LOCATION CANDIDATES
    if (candidate.type === "LOCATION") {
      const name = candidate.label || candidateData.name || "Extracted Location";
      const latitude = typeof candidateData.latitude === "number" ? candidateData.latitude : 22.5726; // Default to WB Kolkata regional grid if unspecified
      const longitude = typeof candidateData.longitude === "number" ? candidateData.longitude : 88.3639;

      const existingLoc = await db.location.findFirst({
        where: {
          investigationId,
          name: { equals: name, mode: "insensitive" },
        },
      });

      let locId: string;
      let action: "CREATED" | "MERGED" = "CREATED";

      if (existingLoc) {
        locId = existingLoc.id;
        action = "MERGED";
      } else {
        const newLoc = await db.location.create({
          data: {
            investigationId,
            name,
            latitude,
            longitude,
            address: candidateData.address || candidate.description,
            region: candidateData.region || candidateData.city || "West Bengal",
          },
        });
        locId = newLoc.id;
      }

      return {
        success: true,
        action,
        trustedLocationId: locId,
      };
    }

    // 4. EVENT CANDIDATES
    if (candidate.type === "EVENT") {
      const title = candidate.label || candidateData.title || "Extracted Event";
      const occurredAt = candidateData.date ? new Date(candidateData.date) : candidate.createdAt;

      const newEvent = await db.event.create({
        data: {
          investigationId,
          title,
          description: candidate.description || candidateData.description,
          occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
          metadata: {
            extractedFrom: candidate.evidenceId,
            provenance: {
              sourceEvidenceId: candidate.evidenceId,
              sourceEvidenceTitle: candidate.evidence.title,
              extractionCandidateId: candidate.id,
              sourceExcerpt: excerpt,
              approvedAt: new Date().toISOString(),
              approvedByUserId: userId,
            },
          },
        },
      });

      // Link evidence to event
      await db.eventEvidence.create({
        data: {
          eventId: newEvent.id,
          evidenceId: candidate.evidenceId,
          excerpt,
        },
      });

      return {
        success: true,
        action: "CREATED",
        trustedEventId: newEvent.id,
      };
    }

    return {
      success: true,
      action: "INTEGRATED",
    };
  } catch (err) {
    console.error("Failed to integrate candidate into graph:", err);
    return {
      success: false,
      action: "REJECTED",
      error: err instanceof Error ? err.message : "Graph integration failed",
    };
  }
}
