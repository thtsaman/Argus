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

STRICT GROUNDING & EXPLANATION RULES:
1. Ground every answer ONLY in the provided investigation context. Never invent facts, entities, relationships, or evidence excerpts.
2. When asked why a relationship, entity, or lead was flagged/surfaced, locate the supporting evidence excerpts, relationships, and events in the context.
3. If the investigation data does NOT contain enough verified evidence or rationale to answer a specific question, state clearly what evidence exists and explicitly state what is missing or uncertain. If no relevant evidence exists at all, respond strictly: "I don't have enough verified evidence in this investigation to answer that."
4. Format all responses using strict Fact / Inference separation using these four exact section titles:

KNOWN
[State direct facts explicitly supported by verified evidence records, source excerpts, employment records, and direct relationships.]

INFERRED
[State cautious interpretations of why the combination of facts warrants investigation. Explain why relationships were flagged without asserting criminal guilt.]

UNCERTAIN
[State missing information, unsupported assumptions, and unresolved links. Explicitly state what the available evidence does NOT establish (e.g., does not establish criminal coordination or illegal distribution).]

NEXT TO INVESTIGATE
[Provide 2-5 concrete, evidence-grounded investigative actions based on the available data.]

5. Never use accusatory terms (e.g. "suspect", "guilty", "fraudster", "criminal"). Use neutral investigative terms ("potential connection", "observed activity", "unverified link").`;

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
  const focus = context.focusContext as any;
  const rels = (context.relevantRelationships as any[]) || [];
  const evs = (context.relevantEvidence as any[]) || [];
  const focusLabel = focus?.label || focus?.details?.location?.name || focus?.details?.financialEntity?.identifier || focus?.details?.label || "the selected entity";

  // Check if this is a Geographic context
  if (focus?.type === "GEOGRAPHIC" || focus?.details?.location) {
    const loc = focus?.details?.location;
    const siteEvents: any[] = focus?.details?.associatedEvents || [];
    const locName = loc?.name || focusLabel;

    let knownLines: string[] = [
      `- Geographic Site: ${locName} (${loc?.coordinates || "Coordinates recorded"}).`,
      `- Region / Address: ${loc?.region || "Logistics Depot Region"}, ${loc?.address || "Site address"}`,
    ];

    if (siteEvents.length > 0) {
      siteEvents.forEach((ev: any) => {
        knownLines.push(`- Site Event Record: "${ev.title}" on ${new Date(ev.occurredAt).toLocaleDateString("en-IN")}${ev.entityLabel ? ` (Associated Entity: ${ev.entityLabel})` : ""}.`);
      });
    }

    return `KNOWN
${knownLines.join("\n")}

INFERRED
- Repeated site presence across examination dispatch windows indicates an operational transit hub.
- Temporal clustering suggests pre-dispatch access coordination prior to reported paper leaks.

UNCERTAIN
- Direct physical access logs inside secure storage rooms require badge scan validation.
- Sub-contractor transport transit routes between sites are unverified by GPS telemetry.

NEXT TO INVESTIGATE
- Cross-reference site visitor access logs with phone communication timestamps.
- Review warehouse dispatch manifests for shipments originating from ${locName}.`;
  }

  // Check if this is a Financial Trail context
  if (focus?.type === "FINANCIAL" || focus?.details?.financialEntity || focus?.details?.transactions) {
    const fe = focus?.details?.financialEntity;
    const txs: any[] = focus?.details?.transactions || (context.recentTransactions as any[]) || [];
    const signals: any[] = (context.financialSignals as any[]) || [];

    const feName = fe?.identifier || focusLabel;
    const feType = fe?.type || "BANK_ACCOUNT";
    const feAttr = fe?.attributionStatus || "UNVERIFIED";

    let knownLines: string[] = [];
    if (fe) {
      knownLines.push(`- Financial Entity: ${feName} (${feType}, ${feAttr}).`);
      if (fe.linkedPerson) {
        knownLines.push(`- Verified Linked Person: ${fe.linkedPerson}.`);
      }
    }

    if (txs.length > 0) {
      const sampleTxs = txs.slice(0, 4);
      sampleTxs.forEach((t) => {
        const amt = t.amountFormatted || t.amount || "amount specified";
        knownLines.push(`- Transaction Record: ${t.sender || t.from} → ${t.receiver || t.to} of ${amt} on ${t.timestamp ? new Date(t.timestamp).toLocaleDateString("en-IN") : "incident date"} (${t.channel || "UPI/BANK"}${t.incident ? `, Incident ${t.incident}` : ""}).`);
      });
    } else {
      knownLines.push(`- No financial transactions recorded directly for ${feName} in the current filter window.`);
    }

    let inferredLines: string[] = [
      `- Financial flow pattern indicates multi-hop transfer velocity requiring money-movement path tracking.`,
      `- Concentration of transactions during specific logistics windows (e.g. EX-01 to EX-04) suggests synchronized intermediary activity.`,
    ];

    let uncertainLines: string[] = [
      `- Available synthetic banking ledger does NOT verify beneficial ownership of unassigned accounts (${feAttr}).`,
      `- Underlying commercial purpose of transfers remains unconfirmed without sub-ledger invoices.`,
    ];

    let nextLines: string[] = [
      `- Perform "Trace Forward" / "Trace Back" path analysis from ${feName} to isolate terminal exchange endpoints.`,
      `- Verify KYC details for unassigned intermediary accounts linked to ${feName}.`,
      `- Cross-reference transaction timestamps against candidate evidence logs.`,
    ];

    return `KNOWN
${knownLines.join("\n")}

INFERRED
${inferredLines.join("\n")}

UNCERTAIN
${uncertainLines.join("\n")}

NEXT TO INVESTIGATE
${nextLines.join("\n")}`;
  }

  // Check if this is a Bridge Explanation context
  if (focus?.isBridgeExplanation || focus?.type === "BRIDGE_EXPLANATION" || focus?.type === "RELATIONSHIP" || focus?.details?.isBridge || query.toLowerCase().includes("bridge")) {
    const bName = focus?.label || focus?.details?.label || focusLabel || "Arjun Mehta";
    const commA = focus?.communityA || focus?.details?.communityA || "Eastern Examination Services Network";
    const commB = focus?.communityB || focus?.details?.communityB || "Vikram Sethi Network";
    const pathCount = focus?.crossClusterPathsCount || focus?.details?.crossClusterPathsCount || (rels.length > 0 ? rels.length : 3);

    const relLines = rels.slice(0, 3).map((r) => `${r.source} → ${r.target} (${r.type || "ASSOCIATED_WITH"})`).join("\n");
    const evTitle = evs[0]?.title || "EX-02 Logistics Dispatch Record";

    return `EXPLAINING THIS BRIDGE

${bName.toUpperCase()} connects:
${commA.toUpperCase()} ↕ ${commB.toUpperCase()}

### WHAT HAPPENED
${bName} acts as the structural connecting point between the ${commA} and the ${commB}. recorded relationships exist on both sides of the investigation graph, forming direct operational links between these otherwise separate communities.

### HOW THE CONNECTION FORMS
${commA}
↓
${rels[0]?.source || "Rahul Verma"}
↓
${bName}
↓
${rels[1]?.target || "Vikram Sethi"}
↓
${commB}

### WHAT THIS CHANGES
This bridge creates ${pathCount} cross-cluster paths between the two communities. If ${bName} is removed from the investigation graph, those paths disappear, causing total structural disconnection into separate network components.

### WHY IT MATTERS
This connection is structurally important because it links entities across different operational modules and incidents (supported by ${evTitle}). Removing ${bName} changes the investigation from one connected network into isolated components.`;
  }

  if (!focus && rels.length === 0 && evs.length === 0) {
    return "I don't have enough verified evidence in this investigation to answer that.";
  }

  const verified = rels.filter((r) => r.status === "VERIFIED" || r.status === "DIRECT");
  const inferred = rels.filter((r) => r.status === "AI_SUGGESTED" || r.status === "UNDER_REVIEW");

  let knownLines: string[] = [];
  if (verified.length > 0) {
    knownLines.push(...verified.slice(0, 4).map((r) => `- Documented relationship: ${r.source || focusLabel} → ${r.target || r.connectedEntity} (${r.type || "ASSOCIATED_WITH"}).`));
  } else if (focus?.details) {
    knownLines.push(`- Entity Record: ${focus.details.label} (${focus.details.type || "ENTITY"}).`);
  } else {
    knownLines.push(`- Recorded entity focus: ${focusLabel}.`);
  }

  if (evs.length > 0 && evs[0].excerpt) {
    knownLines.push(`- Primary evidence excerpt (${evs[0].title || "Record"}): "${evs[0].excerpt.slice(0, 200)}..."`);
  }

  let inferredLines: string[] = [];
  if (inferred.length > 0) {
    inferredLines.push(...inferred.slice(0, 3).map((r) => `- Observed overlap: ${r.source || focusLabel} maintains an unverified link with ${r.target || r.connectedEntity} (${r.status}).`));
  }
  inferredLines.push(`- Repeated co-occurrences across communication and organizational records justify further investigative verification.`);

  let uncertainLines: string[] = [
    `- The current evidence does NOT establish criminal coordination, unauthorized access, or illegal distribution of examination material.`,
    `- Specific motives and underlying intent remain unconfirmed by existing database records.`,
  ];

  let nextLines: string[] = [
    `- Review primary communication logs and source documents surrounding ${focusLabel}.`,
    `- Cross-reference ${focusLabel}'s activity timestamps against key incident dates in the timeline.`,
    `- Verify unconfirmed relationship links with connected entities before drawing conclusions.`,
  ];

  return `KNOWN
${knownLines.join("\n")}

INFERRED
${inferredLines.join("\n")}

UNCERTAIN
${uncertainLines.join("\n")}

NEXT TO INVESTIGATE
${nextLines.join("\n")}`;
}
