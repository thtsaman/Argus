"use client";

import type { InvestigationLead } from "@/lib/investigation/leads";
import { LeadPriorityBadge, LeadTypeBadge, LeadStatusBadge } from "./LeadBadges";

interface LeadCardProps {
  lead: InvestigationLead;
  onInvestigate?: (lead: InvestigationLead) => void;
}

export function LeadCard({ lead, onInvestigate }: LeadCardProps) {
  return (
    <div className="surface-elevated p-4 rounded-lg border border-border hover:border-accent/50 transition-all space-y-3 shadow-2xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <LeadPriorityBadge priority={lead.priority} />
          <LeadTypeBadge type={lead.leadType} />
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>

      <div>
        <h4 className="font-serif text-base font-semibold text-foreground">{lead.title}</h4>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{lead.shortDescription}</p>
      </div>

      <div className="p-2.5 bg-background rounded border border-border/70 space-y-1">
        <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">
          Why Surfaced:
        </span>
        <p className="text-xs text-text-secondary">{lead.reason}</p>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
        <div className="text-text-muted">
          {lead.supportingEvidenceIds.length > 0 ? (
            <span>{lead.supportingEvidenceIds.length} evidence record(s)</span>
          ) : (
            <span>No evidence attached</span>
          )}
        </div>

        {onInvestigate && (
          <button
            onClick={() => onInvestigate(lead)}
            className="px-3 py-1 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors shadow-2xs"
          >
            Investigate
          </button>
        )}
      </div>
    </div>
  );
}
