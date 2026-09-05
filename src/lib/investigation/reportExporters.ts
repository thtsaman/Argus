import type { CompleteReportModel } from "./reportTypes";
import { format } from "date-fns";

/**
 * Generate structured Markdown representation of CompleteReportModel.
 */
export function generateReportMarkdown(report: CompleteReportModel): string {
  const { investigation, generatedAt, sections } = report;
  const lines: string[] = [];

  lines.push(`# ARGUS Investigation Brief`);
  lines.push(``);

  // Investigation Overview
  lines.push(`## Investigation Overview`);
  lines.push(`- **Investigation Name:** ${investigation.title}`);
  lines.push(`- **Case ID:** ${investigation.caseNumber}`);
  lines.push(`- **Status:** ${investigation.status}`);
  lines.push(`- **Lead Investigator:** ${investigation.leadName || "Lead Investigator"}`);
  lines.push(`- **Generated At:** ${format(new Date(generatedAt), "yyyy-MM-dd HH:mm:ss 'IST'")}`);
  lines.push(``);

  // Executive Summary
  if (sections.executiveSummary && report.executiveSummary) {
    lines.push(`## 1. Executive Summary`);
    lines.push(report.executiveSummary);
    lines.push(``);
  }

  // Key Findings
  if (sections.keyFindings && report.keyFindings.length > 0) {
    lines.push(`## 2. Key Analytical Findings`);
    report.keyFindings.forEach((f, i) => {
      lines.push(`### 2.${i + 1} ${f.finding}`);
      lines.push(`- **Type:** ${f.isInferred ? "AI-Assisted Candidate" : "Verified Finding"}`);
      lines.push(`- **Status:** ${f.status}`);
      lines.push(`- **Why It Matters:** ${f.whyItMatters}`);
      lines.push(``);
    });
  }

  // Active Leads
  if (sections.leads && report.leads.length > 0) {
    lines.push(`## 3. Active Investigation Leads`);
    report.leads.forEach((l, i) => {
      lines.push(`### Lead ${i + 1}: ${l.title}`);
      lines.push(`- **Category:** ${l.category}`);
      lines.push(`- **Status:** ${l.status}`);
      if (l.priority) lines.push(`- **Priority:** ${l.priority}`);
      lines.push(`- **Supporting Evidence Count:** ${l.evidenceCount}`);
      if (l.explanation) lines.push(`- **Explanation:** ${l.explanation}`);
      lines.push(``);
    });
  }

  // Key Tracked Entities
  if (sections.keyEntities && report.entities.length > 0) {
    lines.push(`## 4. Key Tracked Entities`);
    report.entities.forEach((e) => {
      lines.push(`- **${e.label}** (${e.type}) — ${e.relationshipCount} Relationships`);
      if (e.context) lines.push(`  - Context: ${e.context}`);
    });
    lines.push(``);
  }

  // Bridge Intelligence
  if (sections.bridgeIntelligence && report.bridgeIntelligence.length > 0) {
    lines.push(`## 5. Bridge Intelligence (Structural Connections)`);
    report.bridgeIntelligence.forEach((b) => {
      lines.push(`### Structural Bridge: ${b.label}`);
      lines.push(`- **Connected Communities:** ${b.communities.join(" <---> ")}`);
      lines.push(`- **Explanation:** ${b.explanation}`);
      lines.push(`- **Impact of Removal:** ${b.structuralImpact}`);
      lines.push(``);
    });
  }

  // Financial Intelligence
  if (sections.financialIntelligence && report.financialIntelligence.length > 0) {
    lines.push(`## 6. Financial Intelligence Trail`);
    report.financialIntelligence.forEach((f) => {
      lines.push(`### ${f.title}`);
      if (f.amount) lines.push(`- **Amount:** ₹${f.amount.toLocaleString()}`);
      if (f.source || f.target) lines.push(`- **Flow:** ${f.source || "Source"} ---> [${f.channel || "UPI/BANK"}] ---> ${f.target || "Target"}`);
      lines.push(`- **Details:** ${f.details}`);
      lines.push(``);
    });
  }

  // Geospatial Intelligence
  if (sections.geospatialIntelligence && report.geospatialIntelligence.length > 0) {
    lines.push(`## 7. Geospatial Intelligence`);
    report.geospatialIntelligence.forEach((g) => {
      lines.push(`- **${g.locationName}:** ${g.eventTitle} — ${g.details}`);
    });
    lines.push(``);
  }

  // Temporal Reconstruction
  if (sections.temporalReconstruction && report.temporalReconstruction.length > 0) {
    lines.push(`## 8. Temporal Reconstruction`);
    report.temporalReconstruction.forEach((t) => {
      lines.push(`- **[${t.timeWindow}] ${t.title}:** ${t.details}`);
    });
    lines.push(``);
  }

  // Evidence Records
  if (sections.evidence && report.evidence.length > 0) {
    lines.push(`## 9. Supporting Evidence Records`);
    lines.push(`| Title / Record | Type | Status | Integrity Hash |`);
    lines.push(`| --- | --- | --- | --- |`);
    report.evidence.forEach((ev) => {
      lines.push(`| ${ev.title} | ${ev.type} | ${ev.status} | \`${ev.hash || "N/A"}\` |`);
    });
    lines.push(``);
  }

  // Vyom AI Analysis
  if (sections.argusAnalysis && report.argusAnalyses.length > 0) {
    lines.push(`## 10. Vyom AI Analytical Responses`);
    report.argusAnalyses.forEach((a) => {
      lines.push(`### Query: ${a.question}`);
      lines.push(a.response);
      lines.push(`*Generated: ${format(new Date(a.generatedAt), "yyyy-MM-dd HH:mm")}*`);
      lines.push(``);
    });
  }

  // Tasks
  if (sections.investigationTasks && report.tasks && report.tasks.length > 0) {
    lines.push(`## 11. Active Investigation Tasks`);
    report.tasks.forEach((t) => {
      lines.push(`- **[${t.status}] ${t.title}** (Priority: ${t.priority})`);
      if (t.whyItMatters) lines.push(`  - Why It Matters: ${t.whyItMatters}`);
      if (t.conclusion) lines.push(`  - Conclusion: ${t.conclusion}`);
    });
    lines.push(``);
  }

  // Verification & Provenance
  if (sections.verificationProvenance) {
    const prov = report.verificationProvenance;
    lines.push(`## 12. Provenance & Integrity Status`);
    lines.push(`- **Verified Graph Links:** ${prov.verifiedCount}`);
    lines.push(`- **Under Review Links:** ${prov.underReviewCount}`);
    lines.push(`- **Rejected Links:** ${prov.rejectedCount}`);
    lines.push(`- **AI Suggested Candidates:** ${prov.aiSuggestedCount}`);
    lines.push(`- **Integrity Status:** ${prov.blockchainStatus}`);
    lines.push(``);
  }

  return lines.join("\n");
}

/**
 * Safely escape CSV fields (commas, quotes, newlines, formula characters).
 */
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Neutralize formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generate normalized CSV representation of CompleteReportModel.
 */
export function generateReportCsv(report: CompleteReportModel): string {
  const { investigation, sections } = report;

  const headers = [
    "Investigation ID",
    "Investigation Name",
    "Case ID",
    "Record Type",
    "Record ID",
    "Title / Name",
    "Category / Type",
    "Status",
    "Priority",
    "Details / Description",
    "Source / Channel",
    "Target / Outcome",
    "Reference Hash / Date",
  ];

  const rows: string[][] = [];

  // Add Summary Record
  rows.push([
    investigation.id,
    investigation.title,
    investigation.caseNumber,
    "OVERVIEW",
    investigation.id,
    investigation.title,
    "INVESTIGATION",
    investigation.status,
    "HIGH",
    report.executiveSummary || "",
    investigation.leadName || "",
    "",
    report.generatedAt,
  ]);

  // Key Findings
  if (sections.keyFindings) {
    report.keyFindings.forEach((f) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "KEY_FINDING",
        f.id,
        f.finding,
        f.isInferred ? "AI_INFERRED" : "VERIFIED",
        f.status,
        "HIGH",
        f.whyItMatters,
        "",
        "",
        "",
      ]);
    });
  }

  // Leads
  if (sections.leads) {
    report.leads.forEach((l) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "LEAD",
        l.id,
        l.title,
        l.category,
        l.status,
        l.priority || "MEDIUM",
        l.explanation || "",
        "",
        `Evidence Count: ${l.evidenceCount}`,
        "",
      ]);
    });
  }

  // Entities
  if (sections.keyEntities) {
    report.entities.forEach((e) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "ENTITY",
        e.id,
        e.label,
        e.type,
        "ACTIVE",
        "HIGH",
        e.context || "",
        "",
        `Relationships: ${e.relationshipCount}`,
        "",
      ]);
    });
  }

  // Bridge Intelligence
  if (sections.bridgeIntelligence) {
    report.bridgeIntelligence.forEach((b) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "BRIDGE_INTELLIGENCE",
        b.entityId,
        b.label,
        "STRUCTURAL_BRIDGE",
        "VERIFIED",
        "CRITICAL",
        b.explanation,
        b.communities.join(" | "),
        b.structuralImpact,
        "",
      ]);
    });
  }

  // Financial Intelligence
  if (sections.financialIntelligence) {
    report.financialIntelligence.forEach((f) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "FINANCIAL_TRANSACTION",
        f.id,
        f.title,
        f.channel || "BANK",
        "VERIFIED",
        "HIGH",
        f.details,
        f.source || "",
        f.target || "",
        f.amount ? `₹${f.amount}` : "",
      ]);
    });
  }

  // Evidence
  if (sections.evidence) {
    report.evidence.forEach((ev) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "EVIDENCE",
        ev.id,
        ev.title,
        ev.type,
        ev.status,
        "HIGH",
        ev.source || "",
        "",
        "",
        ev.hash || "",
      ]);
    });
  }

  // Tasks
  if (sections.investigationTasks && report.tasks) {
    report.tasks.forEach((t) => {
      rows.push([
        investigation.id,
        investigation.title,
        investigation.caseNumber,
        "TASK",
        t.id,
        t.title,
        "INVESTIGATION_TASK",
        t.status,
        t.priority,
        t.whyItMatters || "",
        "",
        t.conclusion || t.expectedOutcome || "",
        "",
      ]);
    });
  }

  const csvLines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];

  return csvLines.join("\n");
}
