"use client";

import { useState } from "react";

interface DuplicateModalProps {
  isOpen: boolean;
  originalTitle: string;
  originalDescription: string | null;
  onConfirm: (title: string, description: string) => Promise<void>;
  onClose: () => void;
}

export function DuplicateModal({
  isOpen,
  originalTitle,
  originalDescription,
  onConfirm,
  onClose,
}: DuplicateModalProps) {
  const [title, setTitle] = useState(`${originalTitle} — Copy`);
  const [description, setDescription] = useState(originalDescription || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Investigation Name is required.");
      return;
    }

    setLoading(true);
    try {
      await onConfirm(title.trim(), description.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to duplicate investigation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated border border-border rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Duplicate Investigation
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-xs text-text-muted hover:text-foreground px-2 py-1 rounded border border-border transition-colors"
          >
            ✕ Close
          </button>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Create an independent copy of this investigation and its investigation data. The original investigation will remain unchanged.
        </p>

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
              className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-text-secondary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:outline-hidden focus:border-accent resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs bg-accent text-surface-elevated font-medium rounded hover:bg-accent-hover transition-colors shadow-2xs disabled:opacity-50"
            >
              {loading ? "Duplicating..." : "Duplicate Investigation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
