"use client";

import Link from "next/link";

interface ContextBannerProps {
  investigationId: string;
  leadTitle?: string | null;
  entityName?: string | null;
  relationshipName?: string | null;
  onClearContext?: () => void;
}

export function InvestigationContextBanner({
  investigationId,
  leadTitle,
  entityName,
  relationshipName,
  onClearContext,
}: ContextBannerProps) {
  if (!leadTitle && !entityName && !relationshipName) return null;

  return (
    <div className="surface-elevated px-4 py-2.5 rounded-lg border border-border flex items-center justify-between gap-4 mb-6 shadow-2xs">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-semibold text-text-muted uppercase tracking-wider text-[10px]">
          Investigation Context:
        </span>

        {leadTitle && (
          <span className="px-2 py-0.5 bg-accent/10 text-accent font-medium rounded border border-accent/20">
            Lead: {leadTitle}
          </span>
        )}

        {entityName && (
          <span className="px-2 py-0.5 bg-background text-foreground font-medium rounded border border-border">
            Entity: {entityName}
          </span>
        )}

        {relationshipName && (
          <span className="px-2 py-0.5 bg-background text-foreground font-medium rounded border border-border">
            Rel: {relationshipName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onClearContext ? (
          <button
            onClick={onClearContext}
            className="text-[11px] px-2 py-1 text-text-muted hover:text-foreground border border-border rounded transition-colors"
          >
            Clear Context
          </button>
        ) : (
          <Link
            href={`/investigations/${investigationId}`}
            className="text-[11px] px-2 py-1 text-text-muted hover:text-foreground border border-border rounded transition-colors"
          >
            Clear Context
          </Link>
        )}
      </div>
    </div>
  );
}
