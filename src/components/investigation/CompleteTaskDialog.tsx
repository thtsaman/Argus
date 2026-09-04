"use client";

import { useState } from "react";
import type { InvestigationTaskItem } from "./InvestigationTaskCard";

interface CompleteTaskDialogProps {
  task: InvestigationTaskItem;
  investigationId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskCompleted: (updatedTask: InvestigationTaskItem) => void;
}

export function CompleteTaskDialog({
  task,
  investigationId,
  isOpen,
  onClose,
  onTaskCompleted,
}: CompleteTaskDialogProps) {
  const [investigatorConclusion, setInvestigatorConclusion] = useState("");
  const [conclusionType, setConclusionType] = useState<
    "CONFIRMED" | "RULED_OUT" | "INCONCLUSIVE" | "FURTHER_INVESTIGATION_REQUIRED"
  >("CONFIRMED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!investigatorConclusion.trim()) {
      setError("Investigator Finding explanation is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/investigations/${investigationId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          investigatorConclusion,
          conclusionType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete task");
      }

      onTaskCompleted(data.task);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to complete task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background surface-elevated border border-border rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold block">
              Task Lifecycle Completion
            </span>
            <h3 className="font-serif text-lg font-semibold text-foreground">
              Complete Investigation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm px-2 py-1 rounded border border-border"
          >
            ✕
          </button>
        </div>

        <div className="p-3 bg-surface rounded border border-border/80 text-xs space-y-1">
          <span className="font-semibold text-foreground block">{task.title}</span>
          <p className="text-text-secondary text-[11px]">{task.description}</p>
        </div>

        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">
              Investigator Finding *
            </label>
            <textarea
              required
              rows={4}
              value={investigatorConclusion}
              onChange={(e) => setInvestigatorConclusion(e.target.value)}
              placeholder="Record your formal analytical finding based on the evidence examined..."
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Analytical Conclusion *
            </label>
            <select
              value={conclusionType}
              onChange={(e) => setConclusionType(e.target.value as any)}
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent font-medium"
            >
              <option value="CONFIRMED">CONFIRMED (Evidence supports link/fact)</option>
              <option value="RULED_OUT">RULED OUT (Evidence disproves or clears link)</option>
              <option value="INCONCLUSIVE">INCONCLUSIVE (Evidence is insufficient)</option>
              <option value="FURTHER_INVESTIGATION_REQUIRED">
                FURTHER INVESTIGATION REQUIRED (Requires follow-up task)
              </option>
            </select>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-border bg-surface text-text-secondary hover:text-foreground text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Record & Complete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
