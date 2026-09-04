"use client";

import { useState } from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async () => {
    setError(null);
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="font-serif text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
        </div>

        {error && (
          <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:bg-surface transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors shadow-2xs ${
              isDestructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-accent hover:bg-accent-hover text-surface-elevated"
            }`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
