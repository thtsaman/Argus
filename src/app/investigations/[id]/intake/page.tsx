"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, SectionHeader } from "@/components/ui/common";

export default function IntakePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [title, setTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append("investigationId", id);
      formData.append("title", title || file?.name || "Uploaded evidence");

      if (mode === "paste") {
        formData.append("pasteText", pasteText);
      } else if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`/api/investigations/${id}/evidence`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setStatus(`Evidence processed. ${data.candidatesCreated || 0} candidate findings created for review.`);
      setTitle("");
      setPasteText("");
      setFile(null);

      setTimeout(() => router.push(`/investigations/${id}/review`), 2000);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto px-6 py-8">
      <PageHeader
        title="Evidence intake"
        description="Upload files or paste text to extract candidate entities, events, and relationships."
      />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("upload")}
          className={`text-sm px-4 py-1.5 rounded transition-colors ${
            mode === "upload" ? "bg-accent text-surface-elevated" : "border border-border"
          }`}
        >
          File upload
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`text-sm px-4 py-1.5 rounded transition-colors ${
            mode === "paste" ? "bg-accent text-surface-elevated" : "border border-border"
          }`}
        >
          Paste text
        </button>
      </div>

      <form onSubmit={handleSubmit} className="surface-elevated p-6 space-y-4">
        <div>
          <label className="text-sm text-text-secondary block mb-1">Evidence title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm border border-border rounded px-3 py-2 bg-surface"
            placeholder="Descriptive title for this evidence"
          />
        </div>

        {mode === "upload" ? (
          <div>
            <label className="text-sm text-text-secondary block mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.csv,.json,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            <p className="text-xs text-text-muted mt-1">Supported: PDF, DOCX, TXT, CSV, JSON</p>
          </div>
        ) : (
          <div>
            <label className="text-sm text-text-secondary block mb-1">Evidence text</label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={10}
              className="w-full text-sm border border-border rounded px-3 py-2 bg-surface font-mono"
              placeholder="Paste investigation report text, communication logs, or other evidence content..."
            />
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || (mode === "upload" ? !file : !pasteText)}
          className="text-sm px-6 py-2 bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {uploading ? "Processing..." : "Submit evidence"}
        </button>

        {status && (
          <p className={`text-sm ${status.includes("failed") ? "text-status-rejected" : "text-status-verified"}`}>
            {status}
          </p>
        )}
      </form>

      <div className="mt-8 surface p-5">
        <SectionHeader title="Processing pipeline" />
        <div className="text-sm text-text-secondary space-y-1">
          <p>File Upload / Paste Text → Evidence Record → Content Extraction</p>
          <p>→ Structured Parsing or GenAI Extraction → Candidate Findings → Human Review</p>
        </div>
      </div>
    </div>
  );
}
