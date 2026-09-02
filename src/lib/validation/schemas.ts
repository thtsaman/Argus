import { z } from "zod";

export const idSchema = z.string().min(1);

export const aiQuerySchema = z.object({
  investigationId: idSchema,
  query: z.string().min(1).max(2000),
  entityId: idSchema.optional(),
  relationshipId: idSchema.optional(),
  focusContext: z.any().optional(),
});

export const verifyRelationshipSchema = z.object({
  relationshipId: idSchema,
  action: z.enum(["verify", "reject"]),
});

export const verifyCandidateSchema = z.object({
  candidateId: idSchema,
  action: z.enum(["verify", "reject"]),
});

export const connectionPathSchema = z.object({
  investigationId: idSchema,
  sourceId: idSchema,
  targetId: idSchema,
});

export const evidenceUploadSchema = z.object({
  investigationId: idSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  pasteText: z.string().max(100000).optional(),
});

export const extractionSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["PERSON", "LOCATION", "VEHICLE", "PHONE", "ORGANIZATION", "ACCOUNT"]),
      aliases: z.array(z.string()).optional(),
      identifiers: z.array(z.string()).optional(),
      excerpt: z.string().optional(),
    })
  ).default([]),
  relationships: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      excerpt: z.string().optional(),
      explanation: z.string().optional(),
    })
  ).default([]),
  events: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.string().optional(),
      location: z.string().optional(),
      entitiesInvolved: z.array(z.string()).optional(),
      excerpt: z.string().optional(),
    })
  ).default([]),
  locations: z.array(
    z.object({
      name: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      excerpt: z.string().optional(),
    })
  ).default([]),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
