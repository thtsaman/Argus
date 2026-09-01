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
      type: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })
  ),
  events: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.string().optional(),
      location: z.string().optional(),
    })
  ),
  relationships: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: z.string(),
      confidence: z.number().min(0).max(1).optional(),
    })
  ),
  locations: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  ),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;
