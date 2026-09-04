"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

export interface InvestigationTaskItem {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  whyItMatters?: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "DISMISSED";
  sourceType: "ARGUS_SUGGESTED" | "LEAD_DERIVED" | "INVESTIGATOR_CREATED";
  expectedOutcome?: string | null;
  investigatorConclusion?: string | null;
  conclusionType?: "CONFIRMED" | "RULED_OUT" | "INCONCLUSIVE" | "FURTHER_INVESTIGATION_REQUIRED" | null;
  entityId?: string | null;
  entity?: { id: string; label: string; type: string } | null;
  relationshipId?: string | null;
  relationship?: { id: string; source: { id: string; label: string }; target: { id: string; label: string } } | null;
  evidenceId?: string | null;
  evidence?: { id: string; title: string; type: string } | null;
  leadId?: string | null;
  eventId?: string | null;
  completedAt?: string | Date | null;
  createdAt?: string | Date;
}

interface InvestigationTaskCardProps {
  task: InvestigationTaskItem;
  investigationId: string;
  onStatusChange?: (taskId: string, newStatus: InvestigationTaskItem["status"]) => void;
  onCompleteTask?: (task: InvestigationTaskItem) => void;
  onCreateFollowUp?: (task: InvestigationTaskItem) => void;
  onFocusGraph?: (entityId?: string, relationshipId?: string) => void;
}

export function InvestigationTaskCard({
  task,
  investigationId,
  onStatusChange,
  onCompleteTask,
  onCreateFollowUp,
  onFocusGraph,
}: InvestigationTaskCardProps) {
  const [isExpanding, setIsExpanding] = useState(false);

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "IN_PROGRESS":
        return "bg-accent/10 text-accent border-accent/20";
      case "BLOCKED":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "DISMISSED":
        return "bg-surface text-text-muted border-border";
      default:
        return "bg-surface text-text-secondary border-border";
    }
  };

  const getConclusionBadgeClass = (conclusion?: string | null) => {
    switch (conclusion) {
      case "CONFIRMED":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "RULED_OUT":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "FURTHER_INVESTIGATION_REQUIRED":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="p-4 bg-background rounded-lg border border-border space-y-3 hover:border-border/80 transition-colors">
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium uppercase tracking-wider">
          <span className={`px-2 py-0.5 rounded border ${getPriorityBadgeClass(task.priority)}`}>
            {task.priority} PRIORITY
          </span>
          <span className={`px-2 py-0.5 rounded border ${getStatusBadgeClass(task.status)}`}>
            {task.status.replace("_", " ")}
          </span>
          <span className="px-2 py-0.5 rounded border border-border text-text-muted">
            {task.sourceType.replace("_", " ")}
          </span>
        </div>
        {task.createdAt && (
          <span className="text-[10px] text-text-muted font-mono">
            {format(new Date(task.createdAt), "dd MMM yyyy")}
          </span>
        )}
      </div>

      {/* Task Title */}
      <h3 className="font-semibold text-sm text-foreground leading-snug">
        {task.title}
      </h3>

      {/* Structured Investigative Breakdown */}
      <div className="space-y-2 text-xs">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
            What needs to be investigated
          </span>
          <p className="text-text-secondary leading-relaxed mt-0.5">
            {task.description}
          </p>
        </div>

        {task.whyItMatters && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
              Why this matters
            </span>
            <p className="text-text-secondary leading-relaxed mt-0.5">
              {task.whyItMatters}
            </p>
          </div>
        )}

        {task.expectedOutcome && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
              Expected outcome
            </span>
            <p className="text-text-secondary leading-relaxed mt-0.5">
              {task.expectedOutcome}
            </p>
          </div>
        )}

        {/* Evidence & Context Links */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {task.evidence && (
            <div className="px-2 py-1 bg-surface rounded border border-border/80 text-[11px] font-mono text-foreground flex items-center gap-1">
              <span>📄 Evidence:</span>
              <span className="font-sans font-medium">{task.evidence.title}</span>
            </div>
          )}
          {task.entity && (
            <div className="px-2 py-1 bg-surface rounded border border-border/80 text-[11px] font-mono text-foreground flex items-center gap-1">
              <span>👤 Entity:</span>
              <span className="font-sans font-medium">{task.entity.label}</span>
            </div>
          )}
          {task.relationship && (
            <div className="px-2 py-1 bg-surface rounded border border-border/80 text-[11px] font-mono text-foreground flex items-center gap-1">
              <span>🔗 Rel:</span>
              <span className="font-sans font-medium">
                {task.relationship.source.label} → {task.relationship.target.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Completed Investigation Findings Section */}
      {task.status === "COMPLETED" && task.investigatorConclusion && (
        <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/20 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 block">
              Investigator Conclusion
            </span>
            {task.conclusionType && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getConclusionBadgeClass(task.conclusionType)}`}>
                {task.conclusionType.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <p className="text-text-secondary leading-relaxed font-mono text-[11px]">
            "{task.investigatorConclusion}"
          </p>
          {task.completedAt && (
            <span className="text-[10px] text-text-muted block">
              Completed: {format(new Date(task.completedAt), "dd MMM yyyy HH:mm")}
            </span>
          )}

          {task.conclusionType === "FURTHER_INVESTIGATION_REQUIRED" && onCreateFollowUp && (
            <button
              onClick={() => onCreateFollowUp(task)}
              className="mt-2 text-xs px-2.5 py-1 rounded bg-accent text-surface-elevated font-medium hover:bg-accent-hover transition-colors"
            >
              + Create Follow-up Task
            </button>
          )}
        </div>
      )}

      {/* Dynamic Action Buttons */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {task.evidenceId && (
            <Link
              href={`/investigations/${investigationId}/evidence-library`}
              className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground text-[11px] font-medium transition-colors"
            >
              View Evidence
            </Link>
          )}
          {task.entityId && (
            <Link
              href={`/investigations/${investigationId}/evidence-space?entityId=${task.entityId}`}
              className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground text-[11px] font-medium transition-colors"
            >
              View Entity
            </Link>
          )}
          {(task.entityId || task.relationshipId) && onFocusGraph && (
            <button
              onClick={() => onFocusGraph(task.entityId || undefined, task.relationshipId || undefined)}
              className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground text-[11px] font-medium transition-colors"
            >
              Show in Network
            </button>
          )}
          <Link
            href={`/investigations/${investigationId}/timeline${task.entityId ? `?entityId=${task.entityId}` : ""}`}
            className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground text-[11px] font-medium transition-colors"
          >
            View Timeline
          </Link>
        </div>

        {/* Lifecycle Transitions */}
        <div className="flex items-center gap-1.5">
          {task.status === "OPEN" && onStatusChange && (
            <>
              <button
                onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
                className="px-2.5 py-1 rounded bg-accent text-surface-elevated text-[11px] font-medium hover:bg-accent-hover transition-colors"
              >
                Start Investigation
              </button>
              <button
                onClick={() => onStatusChange(task.id, "DISMISSED")}
                className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-elevated text-text-muted hover:text-foreground text-[11px] transition-colors"
              >
                Dismiss
              </button>
            </>
          )}

          {task.status === "IN_PROGRESS" && (
            <>
              {onStatusChange && (
                <button
                  onClick={() => onStatusChange(task.id, "BLOCKED")}
                  className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[11px] font-medium transition-colors"
                >
                  Mark Blocked
                </button>
              )}
              {onCompleteTask && (
                <button
                  onClick={() => onCompleteTask(task)}
                  className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-500 transition-colors"
                >
                  Complete Investigation
                </button>
              )}
            </>
          )}

          {task.status === "BLOCKED" && onStatusChange && (
            <button
              onClick={() => onStatusChange(task.id, "IN_PROGRESS")}
              className="px-2.5 py-1 rounded bg-accent text-surface-elevated text-[11px] font-medium hover:bg-accent-hover transition-colors"
            >
              Resume Investigation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
