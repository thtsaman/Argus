"use client";

import { format } from "date-fns";
import type { RelationshipData } from "./RelationshipDetail";

interface EvidenceViewModalProps {
  relationship: RelationshipData;
  onClose: () => void;
}

export function EvidenceViewModal({ relationship, onClose }: EvidenceViewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated rounded-lg border border-border max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
              Supporting Evidence
            </span>
            <h3 className="font-serif text-lg font-semibold text-foreground mt-1">
              {relationship.source.label} → {relationship.target.label}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Why ARGUS associated this relationship ({relationship.type})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm p-1.5 rounded hover:bg-surface border border-border"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {relationship.evidence.length === 0 ? (
            <div className="p-6 text-center surface rounded border border-border">
              <p className="text-sm text-text-muted">
                No direct supporting file attached. Relationship derived from analytical inference.
              </p>
            </div>
          ) : (
            relationship.evidence.map((item, idx) => {
              const ev = item.evidence;
              return (
                <div key={ev.id || idx} className="p-4 surface rounded-lg border border-border space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        Source: {ev.source || "Uploaded document"} · Type: {ev.type}
                      </p>
                    </div>
                    {ev.uploadedAt && (
                      <span className="text-xs text-text-muted font-mono">
                        {format(new Date(ev.uploadedAt), "dd MMM yyyy")}
                      </span>
                    )}
                  </div>

                  {item.excerpt && (
                    <div className="p-3 bg-background rounded border border-border/60 text-xs text-text-secondary font-mono leading-relaxed">
                      <p className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-sans font-medium">Relevant Excerpt:</p>
                      "{item.excerpt}"
                    </div>
                  )}

                  {ev.rawContent && !item.excerpt && (
                    <div className="p-3 bg-background rounded border border-border/60 text-xs text-text-secondary font-mono line-clamp-4 leading-relaxed">
                      {ev.rawContent}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-4 py-2 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
