"use client";

import { useState } from "react";
import Link from "next/link";
import { DetectedPattern, PatternStatus } from "@/lib/investigation/patternDetection";
import { SectionHeader } from "@/components/ui/common";

interface PatternsOverviewSectionProps {
  initialPatterns: DetectedPattern[];
  investigationId: string;
}

export function PatternsOverviewSection({ initialPatterns, investigationId }: PatternsOverviewSectionProps) {
  const [patterns, setPatterns] = useState<DetectedPattern[]>(initialPatterns);

  const handleStatusChange = (patternId: string, newStatus: PatternStatus) => {
    setPatterns((prev) =>
      prev.map((p) => (p.id === patternId ? { ...p, status: newStatus } : p))
    );
  };

  const activePatterns = patterns.filter((p) => p.status !== "DISMISSED");

  if (activePatterns.length === 0) {
    return (
      <div className="surface-elevated p-6 rounded-lg border border-border space-y-2 mb-8">
        <SectionHeader
          title="DETECTED PATTERNS & SIGNALS"
          subtitle="Deterministic anomaly and relationship pattern analysis"
        />
        <div className="p-4 surface rounded border border-border text-center text-xs text-text-muted">
          No active network patterns or structural anomalies detected. All verified entities exhibit expected baseline relationship density.
        </div>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-6 rounded-lg border border-border space-y-4 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <SectionHeader
          title="DETECTED PATTERNS & SIGNALS"
          subtitle="Calculated signals grounded in trusted investigation data (Requires Investigator Review)"
        />
        <span className="text-[10px] font-mono uppercase px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded shrink-0">
          CALCULATED PATTERN
        </span>
      </div>

      <div className="space-y-3">
        {activePatterns.map((pattern) => {
          let targetPath = `/investigations/${investigationId}/evidence-space`;
          if (pattern.targetView === "Timeline") {
            targetPath = `/investigations/${investigationId}/timeline`;
          } else if (pattern.targetView === "Map") {
            targetPath = `/investigations/${investigationId}/map`;
          }

          if (pattern.entityId) {
            targetPath += `?entityId=${pattern.entityId}&entityLabel=${encodeURIComponent(
              pattern.entityLabel || ""
            )}`;
          }

          return (
            <div
              key={pattern.id}
              className="surface p-4 rounded border border-border hover:border-accent transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-accent/15 text-accent rounded uppercase">
                    {pattern.patternType.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted uppercase px-1.5 py-0.5 border border-border rounded">
                    Status: {pattern.status}
                  </span>
                </div>

                <h4 className="font-serif text-sm font-semibold text-foreground">
                  {pattern.title}
                </h4>

                <p className="text-xs text-text-secondary leading-relaxed">
                  {pattern.explanation}
                </p>

                {pattern.supportingEvidenceTitles.length > 0 && (
                  <div className="text-[11px] font-mono text-text-muted">
                    Evidence: {pattern.supportingEvidenceTitles.join(", ")}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-border">
                <Link
                  href={targetPath}
                  className="text-xs px-3 py-1.5 bg-surface-elevated border border-border hover:border-accent rounded text-text-secondary hover:text-foreground font-medium transition-colors"
                >
                  View in {pattern.targetView} →
                </Link>

                {pattern.status !== "RESOLVED" && (
                  <button
                    onClick={() => handleStatusChange(pattern.id, "RESOLVED")}
                    className="text-xs px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded font-medium transition-colors"
                  >
                    Resolve
                  </button>
                )}

                <button
                  onClick={() => handleStatusChange(pattern.id, "DISMISSED")}
                  className="text-xs px-2.5 py-1.5 bg-background text-text-muted hover:text-foreground border border-border rounded font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
