"use client";

import { useState } from "react";
import { format } from "date-fns";

export interface InvestigationData {
  id: string;
  title: string;
  description: string | null;
  status: "ACTIVE" | "ON_HOLD" | "CLOSED" | "ARCHIVED";
  caseNumber: string;
  startDate: string | null;
  endDate: string | null;
  lead?: { name: string } | null;
  _count?: {
    entities: number;
    relationships: number;
    evidence: number;
  };
}

interface InvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (inv: InvestigationData) => void;
  editingInvestigation?: InvestigationData | null;
}

export function InvestigationModal({
  isOpen,
  onClose,
  onSaved,
  editingInvestigation,
}: InvestigationModalProps) {
  const isEdit = !!editingInvestigation;

  const [title, setTitle] = useState(editingInvestigation?.title || "");
  const [description, setDescription] = useState(editingInvestigation?.description || "");
  const [investigator, setInvestigator] = useState("");
  const [sourceOrigin, setSourceOrigin] = useState("");
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [startDate, setStartDate] = useState(
    editingInvestigation?.startDate ? format(new Date(editingInvestigation.startDate), "yyyy-MM-dd") : ""
  );
  const [endDate, setEndDate] = useState(
    editingInvestigation?.endDate ? format(new Date(editingInvestigation.endDate), "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState<"ACTIVE" | "ON_HOLD" | "CLOSED" | "ARCHIVED">(
    editingInvestigation?.status || "ACTIVE"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Investigation Name is required.");
      return;
    }
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("End Date cannot be earlier than Start Date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEdit
        ? `/api/investigations/${editingInvestigation.id}`
        : "/api/investigations";
      const method = isEdit ? "PATCH" : "POST";

      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
        status,
      };

      if (!isEdit) {
        payload.investigator = investigator.trim();
        payload.sourceOrigin = sourceOrigin.trim();
        payload.primaryLocation = primaryLocation.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save investigation");
      }

      onSaved(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated border border-border rounded-lg shadow-lg max-w-xl w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {isEdit ? "Edit Investigation" : "Create Investigation"}
          </h2>
          <button
            onClick={onClose}
            className="text-xs text-text-muted hover:text-foreground px-2 py-1 rounded border border-border transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Investigation Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operation Eastern Corridor"
              className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief operational objective or case summary..."
              rows={3}
              className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent resize-none"
              required
            />
          </div>

          {!isEdit && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Investigator</label>
                <input
                  type="text"
                  value={investigator}
                  onChange={(e) => setInvestigator(e.target.value)}
                  placeholder="Officer Name"
                  className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Source / Origin</label>
                <input
                  type="text"
                  value={sourceOrigin}
                  onChange={(e) => setSourceOrigin(e.target.value)}
                  placeholder="e.g. Cyber Cell"
                  className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">Primary Location</label>
                <input
                  type="text"
                  value={primaryLocation}
                  onChange={(e) => setPrimaryLocation(e.target.value)}
                  placeholder="e.g. Kolkata"
                  className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-secondary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs bg-accent text-surface-elevated font-medium rounded hover:bg-accent-hover transition-colors shadow-2xs disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create & Start Intake"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
