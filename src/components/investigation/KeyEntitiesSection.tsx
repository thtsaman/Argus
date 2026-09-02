"use client";

import Link from "next/link";
import { KeyEntityResult } from "@/lib/investigation/influenceAnalysis";
import { SectionHeader } from "@/components/ui/common";

interface KeyEntitiesSectionProps {
  keyEntities: KeyEntityResult[];
  investigationId: string;
}

export function KeyEntitiesSection({ keyEntities, investigationId }: KeyEntitiesSectionProps) {
  if (!keyEntities || keyEntities.length === 0) {
    return (
      <div className="surface-elevated p-6 rounded-lg border border-border space-y-2 mb-8">
        <SectionHeader
          title="KEY NETWORK ENTITIES"
          subtitle="Calculated structural centrality & relationship influence"
        />
        <div className="p-4 surface rounded border border-border text-center text-xs text-text-muted">
          No key structural entities surfaced yet. Add and verify more relationships across entities to discover network hubs and bridges.
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-6 rounded-lg border border-border space-y-4 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <SectionHeader
          title="KEY NETWORK ENTITIES"
          subtitle="Deterministic structural analysis of trusted graph connections (Calculated Insight)"
        />
        <span className="text-[10px] font-mono uppercase px-2 py-1 bg-background border border-border rounded text-text-muted shrink-0">
          CALCULATED NETWORK INSIGHT
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {keyEntities.slice(0, 6).map((item) => (
          <div
            key={item.entityId}
            className="surface p-4 rounded border border-border hover:border-accent transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-accent/15 text-accent rounded uppercase">
                  {item.category}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {item.connectionCount} conn · {item.supportingEvidenceCount} ev
                </span>
              </div>

              <div>
                <h4 className="font-serif text-base font-semibold text-foreground">{item.label}</h4>
                <span className="text-[11px] text-text-muted font-mono uppercase">{item.type}</span>
              </div>

              <div className="p-2.5 bg-background rounded border border-border/80 text-xs text-text-secondary leading-relaxed">
                {item.whyItMatters}
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
              <span className="text-text-muted truncate max-w-[150px]">
                {item.relatedEntityLabels.join(", ")}
              </span>
              <Link
                href={`/investigations/${investigationId}/evidence-space?entityId=${item.entityId}&entityLabel=${encodeURIComponent(item.label)}`}
                className="px-2.5 py-1 bg-surface-elevated border border-border hover:border-accent rounded text-text-secondary hover:text-foreground font-medium shrink-0 transition-colors"
              >
                Show in Network →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
