import Papa from "papaparse";

export interface ParsedRecord {
  type: "entity" | "event" | "relationship";
  data: Record<string, string>;
}

export function parseCSV(content: string): ParsedRecord[] {
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  return result.data.map((row) => ({
    type: inferRecordType(row),
    data: row,
  }));
}

export function parseJSON(content: string): ParsedRecord[] {
  const parsed = JSON.parse(content);
  const records = Array.isArray(parsed) ? parsed : parsed.records || parsed.data || [parsed];
  return records.map((row: Record<string, string>) => ({
    type: inferRecordType(row),
    data: row,
  }));
}

function inferRecordType(row: Record<string, string>): ParsedRecord["type"] {
  if (row.source && row.target) return "relationship";
  if (row.date || row.occurredAt || row.timestamp) return "event";
  return "entity";
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/json" || fileName.endsWith(".json")) {
    return buffer.toString("utf-8");
  }

  if (mimeType === "text/csv" || fileName.endsWith(".csv")) {
    return buffer.toString("utf-8");
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    } catch {
      return "[PDF content could not be extracted]";
    }
  }

  return buffer.toString("utf-8");
}

export function detectMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext || ""] || "application/octet-stream";
}
