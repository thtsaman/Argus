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

const EXTRACTION_SYSTEM_PROMPT = `You are ARGUS Intelligence Extraction Engine. Your task is to extract structured intelligence candidates from investigation evidence text.

STRICT INSTRUCTIONS:
1. Extract ONLY information explicitly present in the provided evidence.
2. NEVER invent entities, relationships, dates, locations, or facts.
3. NEVER infer criminal guilt or illegal acts. Use neutral relationship types (OWNS, ASSOCIATED_WITH, COMMUNICATED_WITH, LOCATED_AT, EMPLOYED_BY, PARTICIPATED_IN, TRAVELED_TO, RELATED_TO).
4. Preserve date and fact uncertainty as written in the text.
5. Supported entity types are strictly: PERSON, LOCATION, VEHICLE, PHONE, ORGANIZATION, ACCOUNT.
6. Include exact verbatim text excerpts for every extracted item in the "excerpt" field.
7. Return ONLY valid JSON adhering strictly to the JSON schema without any markdown commentary outside the JSON block.

JSON Schema format:
{
  "entities": [
    {
      "name": "full name or label",
      "type": "PERSON|LOCATION|VEHICLE|PHONE|ORGANIZATION|ACCOUNT",
      "aliases": ["optional alias"],
      "identifiers": ["optional identifier"],
      "excerpt": "exact verbatim text quote"
    }
  ],
  "relationships": [
    {
      "source": "source entity name",
      "target": "target entity name",
      "type": "OWNS|ASSOCIATED_WITH|COMMUNICATED_WITH|LOCATED_AT|EMPLOYED_BY|PARTICIPATED_IN|TRAVELED_TO|RELATED_TO",
      "confidence": 0.85,
      "excerpt": "exact verbatim quote",
      "explanation": "Why ARGUS identified this relationship based on the document text"
    }
  ],
  "events": [
    {
      "title": "event summary",
      "description": "details",
      "date": "approximate or exact date as stated",
      "location": "location if mentioned",
      "entitiesInvolved": ["entity name"],
      "excerpt": "verbatim text quote"
    }
  ],
  "locations": [
    {
      "name": "place name",
      "address": "optional address",
      "city": "optional city",
      "state": "optional state",
      "country": "optional country",
      "excerpt": "verbatim text quote"
    }
  ]
}`;

// Deterministic chunking helper for long evidence text
function chunkContent(text: string, maxChunkLength = 4000): string[] {
  if (text.length <= maxChunkLength) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length > maxChunkLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.slice(0, maxChunkLength)];
}

// Conservative deduplication helper
function deduplicateExtraction(result: ExtractionResult): ExtractionResult {
  const entityMap = new Map<string, ExtractionResult["entities"][0]>();
  for (const item of result.entities) {
    const normKey = `${item.type}:${item.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
    if (!entityMap.has(normKey)) {
      entityMap.set(normKey, { ...item, name: item.name.trim() });
    }
  }

  const relMap = new Map<string, ExtractionResult["relationships"][0]>();
  for (const item of result.relationships) {
    const normKey = `${item.source.trim().toLowerCase()}->${item.target.trim().toLowerCase()}:${item.type}`;
    if (!relMap.has(normKey)) {
      relMap.set(normKey, {
        ...item,
        source: item.source.trim(),
        target: item.target.trim(),
      });
    }
  }

  const eventMap = new Map<string, ExtractionResult["events"][0]>();
  for (const item of result.events) {
    const normKey = `${item.title.trim().toLowerCase()}:${item.date || ""}`;
    if (!eventMap.has(normKey)) {
      eventMap.set(normKey, { ...item, title: item.title.trim() });
    }
  }

  const locMap = new Map<string, ExtractionResult["locations"][0]>();
  for (const item of result.locations) {
    const normKey = item.name.trim().toLowerCase();
    if (!locMap.has(normKey)) {
      locMap.set(normKey, { ...item, name: item.name.trim() });
    }
  }

  return {
    entities: Array.from(entityMap.values()),
    relationships: Array.from(relMap.values()),
    events: Array.from(eventMap.values()),
    locations: Array.from(locMap.values()),
  };
}

export async function extractFromText(
  content: string
): Promise<{ result: ExtractionResult | null; flags: string[]; error?: string }> {
  const flags = detectSuspiciousContent(content);
  const client = getClient();

  if (!client) {
    return {
      result: deduplicateExtraction(generateFallbackExtraction(content)),
      flags,
      error: "Hugging Face API key not configured — using rule-based extraction",
    };
  }

  try {
    const chunks = chunkContent(content);
    const combinedResult: ExtractionResult = {
      entities: [],
      relationships: [],
      events: [],
      locations: [],
    };

    for (const chunk of chunks) {
      const prompt = `${EXTRACTION_SYSTEM_PROMPT}\n\n${wrapEvidenceContent(chunk)}`;

      const response = await client.chatCompletion({
        model: getModel(),
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const rawParsed = JSON.parse(jsonMatch[0]);
          const parsed = extractionSchema.safeParse(rawParsed);
          if (parsed.success) {
            combinedResult.entities.push(...parsed.data.entities);
            combinedResult.relationships.push(...parsed.data.relationships);
            combinedResult.events.push(...parsed.data.events);
            combinedResult.locations.push(...parsed.data.locations);
          }
        } catch {
          // Ignore chunk parse failure and continue
        }
      }
    }

    const deduped = deduplicateExtraction(combinedResult);
    if (
      deduped.entities.length === 0 &&
      deduped.relationships.length === 0 &&
      deduped.events.length === 0 &&
      deduped.locations.length === 0
    ) {
      // Fall back to rule-based parser if AI produced no structured items
      const fallback = deduplicateExtraction(generateFallbackExtraction(content));
      return { result: fallback, flags };
    }

    return { result: deduped, flags };
  } catch (err) {
    const fallback = deduplicateExtraction(generateFallbackExtraction(content));
    return {
      result: fallback,
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
    entities.push({
      name: match[1],
      type: "PERSON",
      excerpt: match[0],
    });
  }

  const phonePattern = /\+?\d{10,13}/g;
  while ((match = phonePattern.exec(content)) !== null) {
    entities.push({
      name: match[0],
      type: "PHONE",
      excerpt: match[0],
    });
  }

  const datePattern = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/g;
  while ((match = datePattern.exec(content)) !== null) {
    events.push({
      title: "Referenced date event",
      date: match[0],
      excerpt: `Date referenced: ${match[0]}`,
    });
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
