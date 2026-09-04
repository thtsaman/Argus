"use client";

import { useState } from "react";
import type { InvestigationTaskItem } from "./InvestigationTaskCard";

interface CreateTaskDialogProps {
  investigationId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (task: InvestigationTaskItem) => void;
  prefill?: {
    title?: string;
    description?: string;
    whyItMatters?: string;
    expectedOutcome?: string;
    entityId?: string;
    relationshipId?: string;
    evidenceId?: string;
    leadId?: string;
    parentTaskId?: string;
    sourceType?: "ARGUS_SUGGESTED" | "LEAD_DERIVED" | "INVESTIGATOR_CREATED";
  };
}

export function CreateTaskDialog({
  investigationId,
  isOpen,
  onClose,
  onTaskCreated,
  prefill,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState(prefill?.title || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [whyItMatters, setWhyItMatters] = useState(prefill?.whyItMatters || "");
  const [expectedOutcome, setExpectedOutcome] = useState(prefill?.expectedOutcome || "");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and What needs investigation description are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/investigations/${investigationId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          whyItMatters,
          expectedOutcome,
          priority,
          sourceType: prefill?.sourceType || "INVESTIGATOR_CREATED",
          entityId: prefill?.entityId || null,
          relationshipId: prefill?.relationshipId || null,
          evidenceId: prefill?.evidenceId || null,
          leadId: prefill?.leadId || null,
          parentTaskId: prefill?.parentTaskId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create task");
      }

      onTaskCreated(data.task);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background surface-elevated border border-border rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {prefill?.parentTaskId ? "Create Follow-up Task" : "Create Investigation Task"}
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm px-2 py-1 rounded border border-border"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Verify ownership of account ACC-2098"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              What needs investigation? *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the specific evidence gap or unanswered question..."
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Why it matters
            </label>
            <textarea
              rows={2}
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              placeholder="Explain why establishing this detail is crucial for the case..."
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Expected Outcome
            </label>
            <input
              type="text"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="e.g. Associate or rule out connection to logistics vendor"
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-xs focus:outline-none focus:border-accent"
            >
              <option value="HIGH">HIGH Priority</option>
              <option value="MEDIUM">MEDIUM Priority</option>
              <option value="LOW">LOW Priority</option>
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
              className="px-4 py-1.5 rounded bg-accent text-surface-elevated text-xs font-medium hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
