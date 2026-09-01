"use client";

import { useState } from "react";
import type { RelationshipStatus } from "@prisma/client";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";

interface VerificationActionsProps {
  relationshipId: string;
  investigationId: string;
  currentStatus: RelationshipStatus;
  sourceLabel: string;
  targetLabel: string;
  supportingEvidenceCount: number;
  onStatusUpdated?: (newStatus: RelationshipStatus) => void;
}

export function VerificationActions({
  relationshipId,
  investigationId,
  currentStatus,
  sourceLabel,
  targetLabel,
  supportingEvidenceCount,
  onStatusUpdated,
}: VerificationActionsProps) {
  const [modalMode, setModalMode] = useState<"verify" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVerified = currentStatus === "VERIFIED" || currentStatus === "DIRECT";

  const handleAction = async (action: "verify" | "reject" | "under_review") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigations/${investigationId}/relationships/${relationshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }

      const updatedStatus = action === "verify" ? "VERIFIED" : action === "reject" ? "REJECTED" : "UNDER_REVIEW";
      setModalMode(null);
      setNote("");
      onStatusUpdated?.(updatedStatus as RelationshipStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute decision");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted font-medium">Verification Status:</span>
        <RelationshipStatusBadge status={currentStatus} />
      </div>

      {!isVerified ? (
        <div className="flex gap-2">
          <button
            onClick={() => setModalMode("verify")}
            className="flex-1 text-xs py-1.5 px-3 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors shadow-2xs text-center"
          >
            Verify
          </button>
          <button
            onClick={() => setModalMode("reject")}
            className="flex-1 text-xs py-1.5 px-3 border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground rounded font-medium transition-colors text-center"
          >
            Reject
          </button>
          <button
            onClick={() => handleAction("under_review")}
            disabled={currentStatus === "UNDER_REVIEW"}
            className="text-xs py-1.5 px-2 border border-border text-text-muted hover:text-foreground rounded transition-colors disabled:opacity-50"
          >
            Keep Under Review
          </button>
        </div>
      ) : (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-700 dark:text-emerald-400 font-medium text-center">
          Verified by investigator
        </div>
      )}

      {/* Compact Confirmation Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="surface-elevated rounded-lg border border-border max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="border-b border-border pb-3">
              <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
                Confirmation Step
              </span>
              <h4 className="font-serif text-lg font-semibold text-foreground mt-1 uppercase">
                {modalMode === "verify" ? "VERIFY RELATIONSHIP" : "REJECT RELATIONSHIP"}
              </h4>
              <p className="text-xs text-text-muted mt-0.5">
                {sourceLabel} → {targetLabel}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-background rounded border border-border">
                <span className="text-text-muted block">Supporting Evidence:</span>
                <span className="font-medium text-foreground">{supportingEvidenceCount} record(s)</span>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Investigator Note (optional):</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={modalMode === "verify" ? "Reason for verification..." : "Reason for rejection..."}
                  className="w-full text-xs p-2 bg-background border border-border rounded text-foreground focus:border-accent"
                  rows={2}
                />
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setModalMode(null)}
                className="text-xs px-3 py-1.5 border border-border rounded text-text-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(modalMode)}
                disabled={loading}
                className={`text-xs px-4 py-1.5 rounded text-surface-elevated font-medium transition-colors ${
                  modalMode === "verify" ? "bg-accent hover:bg-accent-hover" : "bg-red-700 hover:bg-red-800"
                }`}
              >
                {loading ? "Saving..." : modalMode === "verify" ? "Confirm Verification" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
