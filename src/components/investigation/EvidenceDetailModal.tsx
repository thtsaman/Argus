"use client";

import { format } from "date-fns";

export interface EvidenceRecordItem {
  id: string;
  investigationId: string;
  title: string;
  fileName?: string | null;
  mimeType?: string | null;
  status: string;
  source?: string | null;
  rawContent?: string | null;
  uploadedAt: string | Date;
  processedAt?: string | Date | null;
  metadata?: Record<string, any> | null;
}

interface EvidenceDetailModalProps {
  evidence: EvidenceRecordItem;
  onClose: () => void;
}

export function EvidenceDetailModal({ evidence, onClose }: EvidenceDetailModalProps) {
  const uploadedDate = new Date(evidence.uploadedAt);
  const formattedUploadDate = isNaN(uploadedDate.getTime())
    ? "Unknown"
    : format(uploadedDate, "dd MMM yyyy, HH:mm");

  const ext = (evidence.fileName || evidence.title).split(".").pop()?.toUpperCase() || "TXT";

  // Map EvidenceStatus enum to clean UI states
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXTRACTED":
      case "READY":
        return (
          <span className="px-2.5 py-0.5 bg-status-verified/20 text-status-verified font-bold text-xs rounded uppercase tracking-wider">
            READY
          </span>
        );
      case "PROCESSING":
        return (
          <span className="px-2.5 py-0.5 bg-accent/20 text-accent font-bold text-xs rounded uppercase tracking-wider animate-pulse">
            PROCESSING
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2.5 py-0.5 bg-status-rejected/20 text-status-rejected font-bold text-xs rounded uppercase tracking-wider">
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 bg-surface text-text-secondary border border-border font-bold text-xs rounded uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated rounded-lg border border-border max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 bg-background border border-border rounded text-text-secondary uppercase">
                {ext}
              </span>
              {getStatusBadge(evidence.status)}
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground break-all">
              {evidence.fileName || evidence.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm p-1.5 rounded hover:bg-surface border border-border transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Source Provenance metadata */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-background rounded-lg border border-border text-xs">
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Original Filename
              </span>
              <span className="text-foreground font-medium truncate block mt-0.5" title={evidence.fileName || evidence.title}>
                {evidence.fileName || evidence.title}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Upload Date
              </span>
              <span className="text-foreground font-medium block mt-0.5">
                {formattedUploadDate}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Evidence ID
              </span>
              <span className="text-foreground font-mono text-[11px] truncate block mt-0.5" title={evidence.id}>
                {evidence.id}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Investigation ID
              </span>
              <span className="text-foreground font-mono text-[11px] truncate block mt-0.5" title={evidence.investigationId}>
                {evidence.investigationId}
              </span>
            </div>
          </div>

          {/* Extracted Text Content Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Extracted Text / Prepared Content Preview
              </h4>
              <span className="text-[11px] text-text-muted">
                {evidence.rawContent ? `${evidence.rawContent.length} characters` : "No preview available"}
              </span>
            </div>

            {evidence.rawContent ? (
              <div className="p-4 bg-background border border-border rounded-lg max-h-[320px] overflow-y-auto font-mono text-xs text-text-secondary leading-relaxed whitespace-pre-wrap select-text">
                {evidence.rawContent}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-lg bg-background/50">
                <p className="text-xs text-text-muted">
                  No text preview is available for this evidence item.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-5 py-2 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
