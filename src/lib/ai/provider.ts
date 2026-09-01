import { HfInference } from "@huggingface/inference";
import { extractionSchema, type ExtractionResult } from "../validation/schemas";

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /disregard\s+(your|the)\s+(instructions|rules)/i,
];

export function detectSuspiciousContent(text: string): string[] {
  const flags: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }
  return flags;
}

function getClient(): HfInference | null {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) return null;
  return new HfInference(apiKey);
}

function getModel(): string {
  return process.env.HUGGINGFACE_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct";
}

const SYSTEM_PROMPT = `You are ARGUS Assistant, an evidence-grounded investigation analysis copilot. Your sole role is to assist analysts in examining investigation evidence, entities, relationships, leads, and events.

STRICT RULES:
1. Ground every answer ONLY in the provided investigation context. Never invent facts, entities, relationships, or evidence.
2. If the investigation data does NOT contain enough verified evidence to answer, respond strictly: "I don't have enough verified evidence in this investigation to answer that."
3. Format all responses using strict Fact / Inference separation using these three exact section titles:

KNOWN
[State direct facts explicitly supported by verified evidence records and direct relationships.]

INFERRED
[State relationships or conclusions marked as AI-suggested, inferred, or candidate findings.]

UNCERTAIN
[State unverified links, evidence gaps, or items requiring investigator decision/review.]

4. Never use accusatory terms (e.g. "suspect", "guilty", "fraudster"). Use neutral investigative terms ("potential connection", "observed activity", "unverified link").`;

function wrapEvidenceContent(content: string): string {
  const flags = detectSuspiciousContent(content);
  const warning =
    flags.length > 0
      ? `\n[SECURITY NOTE: ${flags.length} suspicious pattern(s) detected in evidence content]\n`
      : "";
  return `${warning}--- BEGIN UNTRUSTED EVIDENCE CONTENT ---\n${content}\n--- END UNTRUSTED EVIDENCE CONTENT ---`;
}

export async function extractFromText(
  content: string
): Promise<{ result: ExtractionResult | null; flags: string[]; error?: string }> {
  const flags = detectSuspiciousContent(content);
  const client = getClient();

  if (!client) {
    return {
      result: generateFallbackExtraction(content),
      flags,
      error: "Hugging Face API not configured — using rule-based extraction",
    };
  }

  try {
    const prompt = `${SYSTEM_PROMPT}

Extract structured information from the evidence. Return ONLY valid JSON matching this schema:
{
  "entities": [{"type": "PERSON|ORGANIZATION|PHONE|ACCOUNT|VEHICLE|DEVICE", "label": "name", "description": "optional"}],
  "events": [{"title": "event name", "description": "optional", "date": "ISO date if found", "location": "optional"}],
  "relationships": [{"source": "entity label", "target": "entity label", "type": "relationship type", "confidence": 0.0-1.0}],
  "locations": [{"name": "place name", "description": "optional"}]
}

${wrapEvidenceContent(content.slice(0, 8000))}`;

    const response = await client.chatCompletion({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        result: generateFallbackExtraction(content),
        flags,
        error: "Could not parse AI response as JSON",
      };
    }

    const parsed = extractionSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) {
      return {
        result: generateFallbackExtraction(content),
        flags,
        error: "AI output failed schema validation",
      };
    }

    return { result: parsed.data, flags };
  } catch (err) {
    return {
      result: generateFallbackExtraction(content),
      flags,
      error: err instanceof Error ? err.message : "AI extraction failed",
    };
  }
}

export async function generateExplanation(params: {
  query: string;
  context: Record<string, unknown>;
}): Promise<{ response: string; error?: string }> {
  const client = getClient();

  if (!client) {
    return {
      response: generateFallbackExplanation(params.query, params.context),
      error: "Hugging Face API not configured — using grounded template response",
    };
  }

  try {
    const prompt = `${SYSTEM_PROMPT}

Based ONLY on the investigation context provided below, answer the analyst's question.

Investigation Context:
${JSON.stringify(params.context, null, 2).slice(0, 6000)}

Analyst Question: ${params.query}`;

    const response = await client.chatCompletion({
      model: getModel(),
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.2,
    });

    return { response: response.choices[0]?.message?.content || "No response generated." };
  } catch (err) {
    return {
      response: generateFallbackExplanation(params.query, params.context),
      error: err instanceof Error ? err.message : "AI query failed",
    };
  }
}

function generateFallbackExtraction(content: string): ExtractionResult {
  const entities: ExtractionResult["entities"] = [];
  const relationships: ExtractionResult["relationships"] = [];
  const events: ExtractionResult["events"] = [];
  const locations: ExtractionResult["locations"] = [];

  const namePattern = /(?:Mr\.|Mrs\.|Ms\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
  let match;
  while ((match = namePattern.exec(content)) !== null) {
    entities.push({ type: "PERSON", label: match[1] });
  }

  const phonePattern = /\+?\d{10,13}/g;
  while ((match = phonePattern.exec(content)) !== null) {
    entities.push({ type: "PHONE", label: match[0] });
  }

  const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g;
  while ((match = datePattern.exec(content)) !== null) {
    events.push({ title: "Referenced event", date: match[0] });
  }

  return { entities, events, relationships, locations };
}

function generateFallbackExplanation(
  query: string,
  context: Record<string, unknown>
): string {
  const entities = (context.entities as { label: string; type: string }[]) || [];
  const relationships =
    (context.relationships as { source: string; target: string; status: string; type?: string; evidence?: string[] }[]) || [];
  const activeFocus = context.focusContext as { type?: string; label?: string } | undefined;

  const verifiedRels = relationships.filter((r) => r.status === "VERIFIED" || r.status === "DIRECT");
  const inferredRels = relationships.filter((r) => r.status === "AI_SUGGESTED" || r.status === "UNDER_REVIEW");

  if (entities.length === 0 && relationships.length === 0) {
    return "I don't have enough verified evidence in this investigation to answer that.";
  }

  const focusLabel = activeFocus?.label ? ` focusing on ${activeFocus.label}` : "";

  return `KNOWN
- Retrieved ${entities.length} entities and ${verifiedRels.length} verified/direct relationship records${focusLabel}.
${verifiedRels.slice(0, 3).map((r) => `- Direct connection: ${r.source} → ${r.target} (${r.type || "ASSOCIATED_WITH"})`).join("\n")}

INFERRED
- Identified ${inferredRels.length} analytical links requiring investigator review.
${inferredRels.slice(0, 3).map((r) => `- Analytical lead: ${r.source} → ${r.target} (${r.status})`).join("\n")}

UNCERTAIN
- ${relationships.length - verifiedRels.length - inferredRels.length} relationships or candidate findings remain unverified or pending decision.`;
}
