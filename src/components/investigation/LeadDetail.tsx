"use client";

import Link from "next/link";
import type { InvestigationLead, LeadStatus } from "@/lib/investigation/leads";
import { LeadPriorityBadge, LeadTypeBadge, LeadStatusBadge } from "./LeadBadges";

interface LeadDetailProps {
  lead: InvestigationLead;
  investigationId: string;
  onStatusChange?: (leadId: string, newStatus: LeadStatus) => void;
  onClose?: () => void;
  onFocusGraph?: (lead: InvestigationLead) => void;
  onViewEvidence?: (evidenceIds: string[]) => void;
}

export function LeadDetail({
  lead,
  investigationId,
  onStatusChange,
  onClose,
  onFocusGraph,
  onViewEvidence,
}: LeadDetailProps) {
  return (
    <div className="surface-elevated p-5 rounded-lg border border-border space-y-5 shadow-sm">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <LeadPriorityBadge priority={lead.priority} />
          <LeadTypeBadge type={lead.leadType} />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-xs px-2 py-1 rounded border border-border"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Title & Status */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-xl font-semibold text-foreground">{lead.title}</h3>
          <LeadStatusBadge status={lead.status} />
        </div>
        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{lead.shortDescription}</p>
      </div>

      {/* Why this was surfaced */}
      <div className="space-y-2 p-3.5 bg-background rounded-lg border border-border">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Why this lead was surfaced
        </h4>
        <ul className="space-y-1.5 text-xs text-text-secondary list-disc list-inside">
          {lead.explanationBullets.map((bullet, idx) => (
            <li key={idx} className="leading-relaxed">
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {/* Related Entities */}
      {lead.relatedEntityLabels.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-text-muted font-semibold uppercase tracking-wider">
            Related Entities
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {lead.relatedEntityLabels.map((lbl, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-1 bg-background border border-border rounded font-medium text-foreground"
              >
                {lbl}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supporting Evidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs text-text-muted font-semibold uppercase tracking-wider">
            Supporting Evidence ({lead.supportingEvidenceTitles.length})
          </h4>
        </div>
        {lead.supportingEvidenceTitles.length === 0 ? (
          <p className="text-xs text-text-muted p-3 surface rounded border border-border">
            No primary evidence files directly linked to this lead state.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {lead.supportingEvidenceTitles.map((title, idx) => (
              <div
                key={idx}
                className="p-2 bg-background rounded border border-border/70 text-xs text-text-secondary flex justify-between items-center"
              >
                <span className="font-medium truncate max-w-[240px]">{title}</span>
                {onViewEvidence && (
                  <button
                    onClick={() => onViewEvidence([lead.supportingEvidenceIds[idx]])}
                    className="text-[10px] text-accent hover:underline shrink-0"
                  >
                    Inspect
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-border space-y-2">
        <h4 className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2">
          Actions
        </h4>

        <div className="grid grid-cols-2 gap-2">
          {onFocusGraph && (
            <button
              onClick={() => onFocusGraph(lead)}
              className="text-xs py-2 px-3 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors shadow-2xs text-center"
            >
              Focus in Network Graph
            </button>
          )}

          {lead.relatedRelationshipId && (
            <Link
              href={`/investigations/${investigationId}/review`}
              className="text-xs py-2 px-3 border border-accent/40 bg-accent/5 text-accent rounded font-medium hover:bg-accent/10 transition-colors text-center"
            >
              Review Relationship
            </Link>
          )}
        </div>

        {/* Status management buttons */}
        {onStatusChange && (
          <div className="flex items-center gap-1.5 pt-2">
            <span className="text-[11px] text-text-muted font-medium mr-1">Update Status:</span>
            {(["NEW", "INVESTIGATING", "RESOLVED", "DISMISSED"] as LeadStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => onStatusChange(lead.id, st)}
                disabled={lead.status === st}
                className={`text-[10px] px-2 py-1 rounded border capitalize transition-colors ${
                  lead.status === st
                    ? "bg-background border-border-strong text-foreground font-semibold cursor-default"
                    : "border-border text-text-secondary hover:text-foreground hover:bg-surface"
                }`}
              >
                {st.toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
