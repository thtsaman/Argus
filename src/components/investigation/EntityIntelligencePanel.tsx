"use client";

import { motion } from "framer-motion";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import type { RelationshipData } from "./RelationshipDetail";

export interface EntityContextData {
  investigationCount: number;
  relationshipCount: number;
  evidenceCount: number;
  eventCount: number;
  locationCount: number;
  whyItMatters: string | null;
  investigationRelevance?: string | null;
  whatToInvestigateNext?: {
    id: string;
    action: string;
    type: "View Evidence" | "Show in Network" | "View Timeline" | "View Relationship" | "Ask ARGUS";
    targetId?: string;
    entityId?: string;
  }[];
}

export interface FullEntityDetail {
  id: string;
  label: string;
  type: string;
  description: string | null;
  aliases: { alias: string }[];
  metadata?: unknown;
}

export interface HistoryItem {
  id: string;
  label: string;
}

interface EntityIntelligencePanelProps {
  entity: FullEntityDetail;
  investigationId: string;
  context?: EntityContextData;
  relationships: RelationshipData[];
  history: HistoryItem[];
  onSelectEntityFromHistory: (index: number) => void;
  onSelectConnectedEntity: (entityId: string, label: string) => void;
  onSelectRelationship: (relationship: RelationshipData) => void;
  onFocusGraph?: (entityId: string) => void;
  onClose?: () => void;
  onAskArgus?: () => void;
}

export function EntityIntelligencePanel({
  entity,
  investigationId,
  context,
  relationships,
  history,
  onSelectEntityFromHistory,
  onSelectConnectedEntity,
  onSelectRelationship,
  onFocusGraph,
  onClose,
  onAskArgus,
}: EntityIntelligencePanelProps) {
  return (
    <motion.div
      key={entity.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-elevated p-5 rounded-lg border border-border shadow-sm space-y-5 relative"
    >
      {/* Breadcrumb / History */}
      {history.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-2 border-b border-border text-text-muted">
          <span className="shrink-0 font-medium">History:</span>
          {history.map((item, idx) => {
            const isCurrent = idx === history.length - 1;
            return (
              <div key={`${item.id}-${idx}`} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <span>→</span>}
                <button
                  onClick={() => !isCurrent && onSelectEntityFromHistory(idx)}
                  disabled={isCurrent}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    isCurrent
                      ? "bg-background text-foreground font-semibold border border-border"
                      : "hover:bg-surface text-text-secondary hover:text-foreground underline"
                  }`}
                >
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Identity */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
            {entity.type}
          </span>
          <div className="flex items-center gap-2">
            {onFocusGraph && (
              <button
                onClick={() => onFocusGraph(entity.id)}
                className="text-xs px-2 py-1 rounded border border-border hover:border-accent text-text-secondary hover:text-foreground transition-colors"
              >
                Focus in Graph
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-xs text-text-muted hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
                title="Deselect entity & close panel"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <h3 className="font-serif text-xl font-semibold mt-1 text-foreground">{entity.label}</h3>
        {entity.description && (
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">{entity.description}</p>
        )}

        {entity.aliases && entity.aliases.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-xs text-text-muted font-medium mr-1">Aliases:</span>
            {entity.aliases.map((a) => (
              <span
                key={a.alias}
                className="text-xs px-2 py-0.5 bg-background border border-border rounded text-text-secondary"
              >
                {a.alias}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/60">
          <button
            onClick={() => {
              if (onAskArgus) {
                onAskArgus();
              } else {
                window.location.href = `/investigations/${investigationId}/assistant?contextType=ENTITY&contextId=${entity.id}&contextLabel=${encodeURIComponent(entity.label)}`;
              }
            }}
            className="text-xs px-2.5 py-1 rounded bg-accent/10 border border-accent/40 text-accent font-medium hover:bg-accent/20 transition-colors flex items-center gap-1 cursor-pointer"
          >
            ✨ Ask ARGUS
          </button>
          <a
            href={`/investigations/${investigationId}/timeline?entityId=${entity.id}&entityLabel=${encodeURIComponent(entity.label)}`}
            className="text-xs px-2.5 py-1 rounded border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground font-medium transition-colors"
          >
            View Timeline
          </a>
          <a
            href={`/investigations/${investigationId}/map?entityId=${entity.id}&entityLabel=${encodeURIComponent(entity.label)}`}
            className="text-xs px-2.5 py-1 rounded border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground font-medium transition-colors"
          >
            View Locations
          </a>
        </div>

        {/* Provenance Info */}
        {entity.metadata && (entity.metadata as any).provenance && (
          <div className="mt-3 p-2.5 bg-background/80 rounded border border-border/80 text-[11px] space-y-1 font-mono text-text-secondary">
            <span className="text-[10px] text-accent font-sans font-semibold uppercase tracking-wider block">
              Provenanced AI Extraction Record
            </span>
            <div>Source Evidence ID: {(entity.metadata as any).provenance.sourceEvidenceId}</div>
            {(entity.metadata as any).provenance.sourceExcerpt && (
              <div className="italic text-text-muted">
                "{(entity.metadata as any).provenance.sourceExcerpt}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Why this entity matters */}
      <div className="p-3 bg-background rounded-lg border border-border space-y-1">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Why this entity matters
        </h4>
        <p className="text-xs text-text-secondary leading-relaxed">
          {context?.whyItMatters ||
            "No significant analytical finding has been generated for this entity yet."}
        </p>
      </div>

      {/* Investigation Relevance */}
      {context?.investigationRelevance && (
        <div className="p-3 bg-background rounded-lg border border-border space-y-1">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Investigation Relevance
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            {context.investigationRelevance}
          </p>
        </div>
      )}

      {/* What to Investigate Next */}
      {context?.whatToInvestigateNext && context.whatToInvestigateNext.length > 0 && (
        <div className="p-3 bg-background rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              What to Investigate Next
            </h4>
            <span className="text-[10px] font-mono text-text-muted">Investigation Chain</span>
          </div>
          <div className="space-y-3">
            {context.whatToInvestigateNext.map((item, idx) => (
              <div key={item.id} className="p-2.5 bg-surface rounded border border-border/80 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground leading-snug">
                    {idx + 1}. {item.action}
                  </span>
                  <button
                    onClick={() => {
                      if (item.type === "Ask ARGUS" && onAskArgus) {
                        onAskArgus();
                      } else if (item.type === "Show in Network" && onFocusGraph) {
                        onFocusGraph(item.targetId || entity.id);
                      } else if (item.type === "View Relationship") {
                        const foundRel = relationships.find((r) => r.id === item.targetId);
                        if (foundRel) onSelectRelationship(foundRel);
                      } else if (item.type === "View Timeline") {
                        window.location.href = `/investigations/${investigationId}/timeline?entityId=${entity.id}`;
                      } else if (item.type === "View Evidence") {
                        window.location.href = `/investigations/${investigationId}/evidence-library`;
                      }
                    }}
                    className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded border border-border bg-background hover:bg-surface text-accent hover:border-accent transition-colors"
                  >
                    {item.type}
                  </button>
                </div>

                {/* Structured Investigation Chain Cards */}
                <div className="space-y-1 pl-2 border-l-2 border-accent/40 text-[11px] font-mono">
                  <div className="text-text-secondary">
                    <span className="text-accent font-semibold">KNOWN:</span> Associated with {entity.label} records in database.
                  </div>
                  <div className="text-text-secondary">
                    <span className="text-amber-500 font-semibold">UNRESOLVED:</span> Operational details or precise purpose requiring analyst check.
                  </div>
                  <div className="text-text-secondary">
                    <span className="text-text-muted font-semibold">NEXT ACTION:</span> {item.action}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investigation Context */}
      {context && (
        <div className="grid grid-cols-3 gap-2 p-3 surface rounded border border-border text-center text-xs">
          <div>
            <span className="font-serif text-lg font-semibold text-foreground block">
              {context.investigationCount}
            </span>
            <span className="text-[10px] text-text-muted">Cases</span>
          </div>
          <div>
            <span className="font-serif text-lg font-semibold text-foreground block">
              {context.relationshipCount}
            </span>
            <span className="text-[10px] text-text-muted">Relationships</span>
          </div>
          <div>
            <span className="font-serif text-lg font-semibold text-foreground block">
              {context.evidenceCount}
            </span>
            <span className="text-[10px] text-text-muted">Evidence</span>
          </div>
          <div>
            <span className="font-serif text-lg font-semibold text-foreground block">
              {context.eventCount}
            </span>
            <span className="text-[10px] text-text-muted">Events</span>
          </div>
          <div>
            <span className="font-serif text-lg font-semibold text-foreground block">
              {context.locationCount}
            </span>
            <span className="text-[10px] text-text-muted">Locations</span>
          </div>
        </div>
      )}

      {/* Relationships */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="text-xs text-text-muted font-semibold uppercase tracking-wider">
            Connected Relationships ({relationships.length})
          </h4>
        </div>

        {relationships.length === 0 ? (
          <p className="text-xs text-text-muted p-3 surface rounded">No direct relationships found.</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {relationships.map((r) => {
              const isTarget = r.source.id === entity.id;
              const connected = isTarget ? r.target : r.source;
              const isDirect = r.status === "DIRECT" || r.status === "VERIFIED";

              return (
                <div
                  key={r.id}
                  className="p-3 rounded bg-background border border-border hover:border-accent transition-colors space-y-2"
                >
                  <div className="flex justify-between items-start text-xs">
                    <div>
                      <button
                        onClick={() => onSelectConnectedEntity(connected.id, connected.label)}
                        className="font-semibold text-foreground hover:text-accent underline text-left transition-colors"
                      >
                        {isTarget ? `→ ${connected.label}` : `← ${connected.label}`}
                      </button>
                      <span className="text-[10px] text-text-muted block font-mono capitalize">
                        {connected.type ? connected.type.toLowerCase() : ""} · {r.type}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectRelationship(r)}
                      className="text-[11px] px-2 py-0.5 rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground font-medium transition-colors"
                    >
                      Details
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <RelationshipStatusBadge status={r.status} />
                      <span className="text-text-muted">({isDirect ? "Direct" : "Inferred"})</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-muted font-mono">
                      {r.confidence != null && <span>{Math.round(r.confidence * 100)}% conf</span>}
                      <span>{r.evidence.length} evidence</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
