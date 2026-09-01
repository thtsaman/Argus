"use client";

import { useState } from "react";
import { format } from "date-fns";

export interface CompareEvidenceModalProps {
  itemA: {
    id: string;
    title: string;
    type: string;
    source: string | null;
    uploadedAt: string | Date | null;
    excerpt?: string | null;
    rawContent?: string | null;
  };
  itemB: {
    id: string;
    title: string;
    type: string;
    source: string | null;
    uploadedAt: string | Date | null;
    excerpt?: string | null;
    rawContent?: string | null;
  };
  conflictTitle: string;
  conflictReason: string;
  onClose: () => void;
  onResolve?: () => void;
}

export function EvidenceComparisonModal({
  itemA,
  itemB,
  conflictTitle,
  conflictReason,
  onClose,
  onResolve,
}: CompareEvidenceModalProps) {
  const [resolving, setResolving] = useState(false);

  const handleResolveClick = async () => {
    if (!onResolve) return;
    setResolving(true);
    await onResolve();
    setResolving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated rounded-lg border border-border max-w-4xl w-full max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-red-950/20 text-red-700 dark:text-red-400 border border-red-800/30 rounded">
              EVIDENCE CONFLICT COMPARISON
            </span>
            <h3 className="font-serif text-lg font-semibold text-foreground mt-1">
              {conflictTitle}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">{conflictReason}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm p-1.5 rounded hover:bg-surface border border-border"
          >
            ✕
          </button>
        </div>

        {/* Side-by-side comparison body */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {/* Record A */}
          <div className="surface p-4 rounded-lg border border-border space-y-3">
            <div className="flex justify-between items-start border-b border-border pb-2">
              <div>
                <span className="text-[10px] font-mono text-text-muted uppercase block">
                  SOURCE RECORD A
                </span>
                <h4 className="font-semibold text-sm text-foreground">{itemA.title}</h4>
              </div>
              {itemA.uploadedAt && (
                <span className="text-xs text-text-muted font-mono">
                  {format(new Date(itemA.uploadedAt), "dd MMM yyyy")}
                </span>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-text-muted block">Evidence Type: {itemA.type}</span>
              <span className="text-text-muted block">Source: {itemA.source || "Uploaded File"}</span>
            </div>

            <div className="p-3 bg-background rounded border border-border/70 text-xs font-mono leading-relaxed text-text-secondary">
              <span className="text-[10px] text-text-muted uppercase tracking-wider block font-sans mb-1 font-medium">
                Record Content / Excerpt:
              </span>
              "{itemA.excerpt || itemA.rawContent || "No excerpt extracted."}"
            </div>
          </div>

          {/* Record B */}
          <div className="surface p-4 rounded-lg border border-border space-y-3">
            <div className="flex justify-between items-start border-b border-border pb-2">
              <div>
                <span className="text-[10px] font-mono text-text-muted uppercase block">
                  SOURCE RECORD B
                </span>
                <h4 className="font-semibold text-sm text-foreground">{itemB.title}</h4>
              </div>
              {itemB.uploadedAt && (
                <span className="text-xs text-text-muted font-mono">
                  {format(new Date(itemB.uploadedAt), "dd MMM yyyy")}
                </span>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-text-muted block">Evidence Type: {itemB.type}</span>
              <span className="text-text-muted block">Source: {itemB.source || "Uploaded File"}</span>
            </div>

            <div className="p-3 bg-background rounded border border-border/70 text-xs font-mono leading-relaxed text-text-secondary">
              <span className="text-[10px] text-text-muted uppercase tracking-wider block font-sans mb-1 font-medium">
                Record Content / Excerpt:
              </span>
              "{itemB.excerpt || itemB.rawContent || "No excerpt extracted."}"
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-muted">
            Review both sources to make an investigator determination.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-4 py-2 border border-border rounded text-text-secondary hover:text-foreground"
            >
              Close
            </button>
            {onResolve && (
              <button
                onClick={handleResolveClick}
                disabled={resolving}
                className="text-xs px-4 py-2 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors"
              >
                {resolving ? "Resolving..." : "Mark Resolved"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
