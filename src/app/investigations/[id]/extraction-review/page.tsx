"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader, LoadingState, ConfidenceIndicator } from "@/components/ui/common";

interface CandidateItem {
  id: string;
  evidenceId: string;
  type: string;
  status: string;
  label: string;
  description: string | null;
  confidence: number | null;
  sourceExcerpt: string | null;
  data: Record<string, any>;
  evidence?: {
    id: string;
    title: string;
    fileName: string | null;
  };
}

export default function ExtractionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [processing, setProcessing] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const loadCandidates = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigations/${id}/candidates`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      console.error("Failed to load extracted candidates");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleAction = async (candidateId: string, action: "verify" | "reject") => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/investigations/${id}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      await loadCandidates();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    } catch {
      alert("Failed to update item decision");
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      for (const candId of Array.from(selectedIds)) {
        await fetch(`/api/investigations/${id}/candidates/${candId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify" }),
        });
      }
      await loadCandidates();
      setSelectedIds(new Set());
    } catch {
      alert("Failed to approve selected candidates");
    } finally {
      setProcessing(false);
    }
  };

  const handleStartEdit = (cand: CandidateItem) => {
    setEditingId(cand.id);
    setEditLabel(cand.label);
    setEditType(cand.type);
    setEditDescription(cand.description || "");
  };

  const handleSaveEdit = async (candidateId: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/investigations/${id}/candidates/${candidateId}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel,
          type: editType,
          description: editDescription,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditingId(null);
      await loadCandidates();
    } catch {
      alert("Failed to save corrections");
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelectAll = (items: CandidateItem[]) => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const toggleSelect = (candId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(candId)) next.delete(candId);
      else next.add(candId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1100px] mx-auto">
        <LoadingState />
      </div>
    );
  }

  const filtered = candidates.filter((c) => {
    const matchesType = typeFilter === "ALL" || c.type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesType && matchesStatus;
  });

  const pendingItems = filtered.filter((c) => c.status === "PENDING");

  const renderBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
      case "APPROVED":
        return (
          <span className="px-2 py-0.5 bg-status-verified/20 text-status-verified font-bold text-[10px] rounded uppercase tracking-wider">
            INVESTIGATOR APPROVED (READY FOR GRAPH INTEGRATION)
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2 py-0.5 bg-status-rejected/20 text-status-rejected font-bold text-[10px] rounded uppercase tracking-wider">
            REJECTED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-accent/20 text-accent font-bold text-[10px] rounded uppercase tracking-wider">
            AI EXTRACTED (PENDING REVIEW)
          </span>
        );
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6" suppressHydrationWarning>
      <PageHeader
        title="EXTRACTION REVIEW"
        description="Inspect, edit, and approve AI-extracted intelligence candidates prior to investigation graph integration."
      />

      {/* Filter and Bulk Action Controls */}
      <div className="surface-elevated p-4 rounded-lg border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
              Status:
            </span>
            {["PENDING", "VERIFIED", "REJECTED", "ALL"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs rounded transition-all ${
                  statusFilter === s
                    ? "bg-accent text-surface-elevated font-semibold shadow-2xs"
                    : "text-text-secondary border border-border hover:text-foreground"
                }`}
              >
                {s === "VERIFIED" ? "APPROVED" : s}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
              Type:
            </span>
            {["ALL", "PERSON", "VEHICLE", "LOCATION", "PHONE", "ORGANIZATION", "ACCOUNT", "RELATIONSHIP", "EVENT"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs rounded transition-all ${
                  typeFilter === t
                    ? "bg-foreground text-background font-semibold"
                    : "text-text-secondary border border-border hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2">
          {pendingItems.length > 0 && (
            <>
              <button
                onClick={() => toggleSelectAll(pendingItems)}
                className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-foreground transition-colors"
              >
                {selectedIds.size === pendingItems.length ? "Deselect All" : "Select All Pending"}
              </button>
              <button
                onClick={handleApproveSelected}
                disabled={selectedIds.size === 0 || processing}
                className="px-4 py-1.5 text-xs bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                Approve Selected ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Candidates List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center surface rounded-lg border border-border space-y-2">
          <h4 className="font-serif text-lg font-semibold text-foreground">NO EXTRACTION CANDIDATES</h4>
          <p className="text-xs text-text-muted">
            No extracted items matching current filter criteria. Upload files via Evidence Intake to run GenAI extraction.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isEditing = editingId === item.id;
            const sourceDoc = item.evidence?.fileName || item.evidence?.title || (item.data?.sourceReference as string) || "Evidence Document";
            const isPending = item.status === "PENDING";

            return (
              <div key={item.id} className="surface-elevated p-5 rounded-lg border border-border space-y-3 shadow-2xs">
                {/* Header line */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {isPending && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-border text-accent focus:ring-accent accent-accent"
                      />
                    )}
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 border border-border rounded bg-background uppercase">
                      {item.type}
                    </span>
                    {renderBadge(item.status)}
                    {item.confidence != null && <ConfidenceIndicator value={item.confidence} />}
                  </div>

                  {!isEditing && isPending && (
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="text-xs text-text-muted hover:text-foreground border border-border px-2.5 py-1 rounded transition-colors"
                    >
                      Edit Candidate
                    </button>
                  )}
                </div>

                {/* Content display or Edit Form */}
                {isEditing ? (
                  <div className="p-4 bg-background border border-border rounded-lg space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">
                          Label / Value
                        </label>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full p-2 border border-border rounded bg-surface text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">
                          Category / Type
                        </label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                          className="w-full p-2 border border-border rounded bg-surface text-foreground"
                        >
                          {["PERSON", "LOCATION", "VEHICLE", "PHONE", "ORGANIZATION", "ACCOUNT", "RELATIONSHIP", "EVENT"].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">
                        Description / Notes
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full p-2 border border-border rounded bg-surface text-foreground"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-text-muted border border-border rounded hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="px-4 py-1 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover"
                      >
                        Save Corrections
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-serif text-lg font-semibold text-foreground">{item.label}</h4>
                    {item.description && (
                      <p className="text-xs text-text-secondary mt-1">{item.description}</p>
                    )}
                  </div>
                )}

                {/* Explanation block for Relationships */}
                {item.type === "RELATIONSHIP" && (
                  <div className="p-3 bg-background rounded border border-border/80 text-xs">
                    <span className="text-[10px] text-accent font-semibold uppercase tracking-wider block mb-0.5">
                      WHY WAS THIS EXTRACTED?
                    </span>
                    <p className="text-text-secondary leading-relaxed">
                      {item.description || `ARGUS identified this relationship because the source document explicitly references this connection.`}
                    </p>
                  </div>
                )}

                {/* Source Excerpt */}
                {item.sourceExcerpt && (
                  <div className="p-3 bg-background/60 rounded border border-border/60 text-xs font-mono text-text-secondary leading-relaxed">
                    <span className="text-[10px] text-text-muted font-sans font-semibold uppercase tracking-wider block mb-1">
                      Source Excerpt ({sourceDoc}):
                    </span>
                    "{item.sourceExcerpt}"
                  </div>
                )}

                {/* Action Buttons */}
                {isPending && !isEditing && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <span className="text-text-muted">Source Evidence: {sourceDoc}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(item.id, "verify")}
                        disabled={processing}
                        className="px-4 py-1.5 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(item.id, "reject")}
                        disabled={processing}
                        className="px-4 py-1.5 border border-border rounded hover:border-border-strong text-text-secondary hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
