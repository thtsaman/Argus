"use client";

import Link from "next/link";
import { format } from "date-fns";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import type { RelationshipStatus } from "@prisma/client";

export interface EvidenceRecord {
  id: string;
  title: string;
  type: string;
  source: string | null;
  uploadedAt: string | Date;
  rawContent?: string | null;
  metadata?: unknown;
}

export interface RelationshipData {
  id: string;
  type: string;
  status: RelationshipStatus;
  confidence: number | null;
  discoveredAt?: string | Date;
  source: { id: string; label: string; type?: string };
  target: { id: string; label: string; type?: string };
  evidence: { excerpt?: string | null; evidence: EvidenceRecord }[];
}

interface RelationshipDetailProps {
  relationship: RelationshipData;
  investigationId: string;
  onFocusGraph?: (sourceId: string, targetId: string) => void;
  onViewEvidence?: (relationship: RelationshipData) => void;
  onClose?: () => void;
}

export function RelationshipDetailPanel({
  relationship,
  investigationId,
  onFocusGraph,
  onViewEvidence,
  onClose,
}: RelationshipDetailProps) {
  const isDirect = relationship.status === "DIRECT" || relationship.status === "VERIFIED";
  const evidenceCount = relationship.evidence.length;

  return (
    <div className="surface-elevated p-5 rounded-lg border border-border space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
            Relationship Detail
          </span>
          <h3 className="font-serif text-lg font-semibold text-foreground mt-1">
            {relationship.source.label} → {relationship.target.label}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm px-2 py-1 rounded border border-border"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-text-muted block">Type</span>
          <span className="font-mono font-medium text-foreground">{relationship.type}</span>
        </div>
        <div>
          <span className="text-text-muted block">Status</span>
          <div className="mt-0.5">
            <RelationshipStatusBadge status={relationship.status} />
          </div>
        </div>
        <div>
          <span className="text-text-muted block">Directness</span>
          <span className="font-medium text-foreground">{isDirect ? "Direct" : "Inferred"}</span>
        </div>
        {relationship.confidence != null && (
          <div>
            <span className="text-text-muted block">Confidence</span>
            <span className="font-mono font-medium text-foreground">
              {Math.round(relationship.confidence * 100)}%
            </span>
          </div>
        )}
        {relationship.discoveredAt && (
          <div>
            <span className="text-text-muted block">Observed</span>
            <span className="text-foreground">
              {format(new Date(relationship.discoveredAt), "dd MMM yyyy")}
            </span>
          </div>
        )}
        <div>
          <span className="text-text-muted block">Supporting Records</span>
          <span className="font-medium text-foreground">{evidenceCount} record(s)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2 border-t border-border">
        {onViewEvidence && (
          <button
            onClick={() => onViewEvidence(relationship)}
            className="w-full text-xs py-2 px-3 rounded bg-accent text-surface-elevated font-medium hover:bg-accent-hover transition-colors text-center shadow-sm"
          >
            View Supporting Evidence ({evidenceCount})
          </button>
        )}

        {onFocusGraph && (
          <button
            onClick={() => onFocusGraph(relationship.source.id, relationship.target.id)}
            className="w-full text-xs py-2 px-3 rounded border border-border bg-background hover:bg-surface hover:border-accent text-text-secondary hover:text-foreground font-medium transition-colors text-center"
          >
            Show in Graph
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/investigations/${investigationId}/timeline`}
            className="text-xs py-1.5 px-2 rounded border border-border bg-background hover:bg-surface hover:border-accent text-text-secondary hover:text-foreground font-medium transition-colors text-center"
          >
            View Timeline
          </Link>
          <Link
            href={`/investigations/${investigationId}/assistant`}
            className="text-xs py-1.5 px-2 rounded border border-border bg-background hover:bg-surface hover:border-accent text-text-secondary hover:text-foreground font-medium transition-colors text-center"
          >
            Ask ARGUS
          </Link>
        </div>
      </div>
    </div>
  );
}
