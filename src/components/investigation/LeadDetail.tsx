"use client";

import Link from "next/link";
import { useState } from "react";
import type { InvestigationLead, LeadStatus } from "@/lib/investigation/leads";
import { LeadPriorityBadge, LeadTypeBadge, LeadStatusBadge } from "./LeadBadges";
import { VerificationActions } from "./VerificationActions";
import type { RelationshipStatus } from "@prisma/client";

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
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);

  const directEvidenceCount = lead.supportingEvidenceIds.length;
  const isInferred = lead.leadType === "UNVERIFIED_RELATIONSHIP" || lead.leadType === "POTENTIAL_BRIDGE";

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

      {/* 1. Finding */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-xl font-semibold text-foreground">{lead.title}</h3>
          <LeadStatusBadge status={lead.status} />
        </div>
        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{lead.shortDescription}</p>
      </div>

      {/* 2. Structured Factual Breakdown (Mandatory Separation) */}
      <div className="space-y-3 p-4 bg-background rounded-lg border border-border">
        {/* Why surfaced */}
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
            Why this was surfaced
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">{lead.reason}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/70 text-xs">
          {/* What is known */}
          <div className="space-y-1">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
              What is Known
            </span>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              {lead.supportingEvidenceTitles.length > 0 ? (
                lead.supportingEvidenceTitles.slice(0, 2).map((t, idx) => (
                  <li key={idx} className="truncate">
                    Doc: {t}
                  </li>
                ))
              ) : (
                <li>Entity identities confirmed in system index</li>
              )}
            </ul>
          </div>

          {/* What is inferred */}
          <div className="space-y-1">
            <span className="font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
              What is Inferred
            </span>
            <p className="text-text-secondary">
              {isInferred
                ? "Relationship structural connection derived from analytical inference."
                : "Standard entity extraction link."}
            </p>
          </div>

          {/* What is missing */}
          <div className="space-y-1">
            <span className="font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider block">
              What is Missing
            </span>
            <p className="text-text-secondary">
              {lead.leadType === "EVIDENCE_GAP"
                ? "Lacks primary source documentation file."
                : "Formal investigator verification."}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Evidence Strength Summary */}
      <div className="p-3 surface rounded border border-border grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <span className="font-serif text-lg font-semibold text-foreground block">
            {directEvidenceCount}
          </span>
          <span className="text-[10px] text-text-muted uppercase">Direct Evidence</span>
        </div>
        <div>
          <span className="font-serif text-lg font-semibold text-foreground block">
            {isInferred ? 1 : 0}
          </span>
          <span className="text-[10px] text-text-muted uppercase">Inferred Link</span>
        </div>
        <div>
          <span className="font-serif text-lg font-semibold text-foreground block">
            {lead.leadType === "UNVERIFIED_RELATIONSHIP" ? 1 : 0}
          </span>
          <span className="text-[10px] text-text-muted uppercase">Unverified Link</span>
        </div>
      </div>

      {/* 4. Supporting Evidence List */}
      <div className="space-y-2">
        <h4 className="text-xs text-text-muted font-semibold uppercase tracking-wider">
          Supporting Evidence ({lead.supportingEvidenceTitles.length})
        </h4>
        {lead.supportingEvidenceTitles.length === 0 ? (
          <p className="text-xs text-text-muted p-3 surface rounded border border-border">
            No direct evidence documents attached.
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
                    className="text-[10px] text-accent hover:underline shrink-0 font-medium"
                  >
                    Inspect Evidence
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Related Investigation Tasks */}
      <div className="p-3 bg-background rounded border border-border space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Investigation Tasks
          </h4>
          <button
            onClick={() => {
              if (window.location) {
                window.location.href = `/investigations/${investigationId}?leadId=${lead.id}#tasks`;
              }
            }}
            className="text-[10px] px-2 py-0.5 rounded border border-accent bg-accent/10 text-accent font-medium hover:bg-accent/20 transition-colors"
          >
            + Create Investigation Task
          </button>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Create or view evidence-grounded tasks derived from this lead context (preserves Lead ID, Entities: {lead.relatedEntityLabels.join(", ") || "None"}).
        </p>
      </div>

      {/* 6. Relationship Verification Actions (if applicable) */}
      {lead.relatedRelationshipId && (
        <div className="p-3 bg-background rounded border border-border space-y-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Review Relationship Decision
          </h4>
          <VerificationActions
            relationshipId={lead.relatedRelationshipId}
            investigationId={investigationId}
            currentStatus={relationshipStatus || "UNDER_REVIEW"}
            sourceLabel={lead.relatedEntityLabels[0] || "Source"}
            targetLabel={lead.relatedEntityLabels[1] || "Target"}
            supportingEvidenceCount={lead.supportingEvidenceIds.length}
            onStatusUpdated={(st) => setRelationshipStatus(st)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="pt-3 border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {onFocusGraph && (
            <button
              onClick={() => onFocusGraph(lead)}
              className="text-xs py-2 px-3 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors shadow-2xs text-center"
            >
              Focus in Network Graph
            </button>
          )}

          <Link
            href={`/investigations/${investigationId}/review`}
            className="text-xs py-2 px-3 border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground rounded font-medium transition-colors text-center"
          >
            Open Review Queue
          </Link>
        </div>

        {/* Lead status updates */}
        {onStatusChange && (
          <div className="flex items-center gap-1.5 pt-2">
            <span className="text-[11px] text-text-muted font-medium mr-1">Lead Status:</span>
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
