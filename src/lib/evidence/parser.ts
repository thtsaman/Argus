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
  const ext = fileName.split(".").pop()?.toLowerCase();

  // Validate empty buffer
  if (!buffer || buffer.length === 0) {
    throw new Error("File is empty");
  }

  // Plain Text & Markdown
  if (mimeType === "text/plain" || ext === "txt" || ext === "md" || mimeType === "text/markdown") {
    const text = buffer.toString("utf-8");
    if (!text.trim()) throw new Error("File content is empty");
    return text;
  }

  // CSV Tabular formatting
  if (mimeType === "text/csv" || ext === "csv") {
    const rawCsv = buffer.toString("utf-8");
    if (!rawCsv.trim()) throw new Error("CSV file content is empty");

    const parsed = Papa.parse<Record<string, string>>(rawCsv, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
    }

    const headers = parsed.meta.fields || [];
    let formattedText = `CSV Table: ${fileName}\n`;
    formattedText += `Columns: ${headers.join(" | ")}\n\nRows:\n`;

    parsed.data.forEach((row, idx) => {
      const rowValues = headers.map((h) => row[h] || "").join(" | ");
      formattedText += `[Row ${idx + 1}] ${rowValues}\n`;
    });

    return formattedText;
  }

  // PDF Parsing
  if (mimeType === "application/pdf" || ext === "pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      
      const text = result?.text ? result.text.trim() : "";
      if (!text) {
        throw new Error("PDF contained no extractable text layer or is scanned image");
      }
      return text;
    } catch (err) {
      if (err instanceof Error && err.message.includes("empty")) {
        throw err;
      }
      throw new Error("Could not process this PDF. The file may be corrupted or contain unsupported content.");
    }
  }

  // Fallback UTF-8 attempt
  try {
    return buffer.toString("utf-8");
  } catch {
    throw new Error("Invalid file encoding or unsupported file format");
  }
}

export function detectMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
  };
  return map[ext || ""] || "application/octet-stream";
}
