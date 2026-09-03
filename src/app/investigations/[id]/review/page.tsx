"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { ConfidenceIndicator } from "@/components/ui/common";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import { EvidenceComparisonModal } from "@/components/investigation/EvidenceComparisonModal";
import type { RelationshipStatus } from "@prisma/client";

interface Candidate {
  id: string;
  type: string;
  status: string;
  label: string;
  description: string | null;
  confidence: number | null;
  sourceExcerpt: string | null;
  data: Record<string, unknown>;
  evidence: { id: string; title: string; type: string; source: string | null; uploadedAt: string | null; rawContent: string | null };
}

interface RelationshipItem {
  id: string;
  type: string;
  status: RelationshipStatus;
  confidence: number | null;
  source: { id: string; label: string };
  target: { id: string; label: string };
  evidence: { evidence: { id: string; title: string; type: string; source: string | null; uploadedAt: string | null; rawContent: string | null }; excerpt: string | null }[];
}

export default function ReviewQueuePage() {
  const { id } = useParams<{ id: string }>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [relationships, setRelationships] = useState<RelationshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  // Comparison modal state
  const [comparisonData, setComparisonData] = useState<{
    itemA: Candidate["evidence"];
    itemB: Candidate["evidence"];
    conflictTitle: string;
    conflictReason: string;
    candidateId?: string;
  } | null>(null);

  const loadQueueData = useCallback(async () => {
    try {
      const [candRes, graphRes] = await Promise.all([
        fetch(`/api/investigations/${id}/candidates?status=${statusFilter}`),
        fetch(`/api/investigations/${id}/graph`),
      ]);
      const candData = await candRes.json();
      const graphData = await graphRes.json();

      const allCandidates: Candidate[] = candData.candidates || [];
      setCandidates(allCandidates);

      // Filter graph links
      if (graphData.links) {
        const links: RelationshipItem[] = graphData.links
          .filter((l: RelationshipItem) => {
            if (statusFilter === "ALL") return true;
            if (statusFilter === "PENDING") return l.status === "UNDER_REVIEW" || l.status === "AI_SUGGESTED";
            if (statusFilter === "VERIFIED") return l.status === "VERIFIED" || l.status === "DIRECT";
            if (statusFilter === "REJECTED") return l.status === "REJECTED";
            return true;
          })
          .map((l: RelationshipItem) => ({
            ...l,
            source: typeof l.source === "object" ? l.source : { id: l.source, label: l.source },
            target: typeof l.target === "object" ? l.target : { id: l.target, label: l.target },
            evidence: l.evidence || [],
          }));
        setRelationships(links);
      }
    } catch {
      console.error("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [id, statusFilter]);

  useEffect(() => {
    loadQueueData();
  }, [loadQueueData]);

  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleCandidateAction = async (candidateId: string, action: "verify" | "reject") => {
    setProcessingId(candidateId);
    setNotification(null);
    try {
      const res = await fetch(`/api/investigations/${id}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      setNotification({
        message: action === "verify" ? "Candidate Approved → Integrated into Investigation Graph!" : "Candidate Rejected — Kept in audit history",
        type: "success",
      });
      await loadQueueData();
    } catch {
      setNotification({ message: "Failed to process candidate", type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRelationshipAction = async (relationshipId: string, action: "verify" | "reject") => {
    setProcessingId(relationshipId);
    setNotification(null);
    try {
      const res = await fetch(`/api/investigations/${id}/relationships/${relationshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      setNotification({
        message: action === "verify" ? "Relationship Verified → Updated in Graph!" : "Relationship Rejected",
        type: "success",
      });
      await loadQueueData();
    } catch {
      setNotification({ message: "Failed to process relationship decision", type: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading)
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );

  const filteredCandidates = candidates.filter((c) => {
    if (typeFilter === "ALL") return true;
    return c.type === typeFilter;
  });

  const filteredRelationships = relationships.filter((r) => {
    if (typeFilter === "ALL") return true;
    return typeFilter === "RELATIONSHIP";
  });

  const totalItems = candidates.length + relationships.length;

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Review Queue & Decision Center"
        description="Inspect candidate findings, unverified relationships, and evidence conflicts requiring investigator verification."
      />

      {notification && (
        <div
          className={`p-4 rounded-lg border text-xs font-medium ${
            notification.type === "success"
              ? "bg-status-verified/10 border-status-verified/40 text-status-verified"
              : "bg-status-rejected/10 border-status-rejected/40 text-status-rejected"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Filter Bar */}
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
            {["ALL", "RELATIONSHIP", "ENTITY", "EVENT", "LOCATION"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 text-xs rounded transition-all ${
                  typeFilter === t
                    ? "bg-foreground text-background font-semibold shadow-2xs"
                    : "text-text-secondary hover:text-foreground border border-border"
                }`}
              >
                {t === "ALL" ? "All Queue Items" : t}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-text-muted font-mono">{totalItems} item(s) matching filter</span>
      </div>

      {totalItems === 0 ? (
        <div className="surface p-8 rounded-lg border border-border text-center space-y-2">
          <h4 className="font-serif text-lg font-semibold text-foreground">
            NO ITEMS REQUIRING REVIEW
          </h4>
          <p className="text-xs text-text-muted">
            All extracted candidates and relationship findings have been processed by the investigator.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unverified Relationships Queue */}
          {filteredRelationships.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Unverified Relationships"
                subtitle="Relationships requiring investigator verification or rejection"
              />
              <div className="space-y-3">
                {filteredRelationships.map((r) => (
                  <div key={r.id} className="surface-elevated p-5 rounded-lg border border-border space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded bg-background">
                            IDENTITY RELATIONSHIP
                          </span>
                          <RelationshipStatusBadge status={r.status} />
                          {r.confidence != null && <ConfidenceIndicator value={r.confidence} />}
                        </div>
                        <h4 className="font-serif text-lg font-semibold text-foreground mt-2">
                          {r.source.label} → {r.target.label}
                        </h4>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Type: <span className="font-mono font-medium">{r.type}</span>
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-background rounded border border-border/70 text-xs text-text-secondary">
                      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">
                        Why it requires review:
                      </span>
                      Relationship is currently {r.status.toLowerCase().replace("_", " ")} and requires explicit verification.
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                      <span className="text-text-muted">{r.evidence?.length || 0} supporting evidence record(s)</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRelationshipAction(r.id, "verify")}
                          disabled={processingId === r.id}
                          className="px-4 py-1.5 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleRelationshipAction(r.id, "reject")}
                          disabled={processingId === r.id}
                          className="px-4 py-1.5 border border-border rounded hover:border-border-strong text-text-secondary hover:text-foreground transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Findings Queue */}
          {filteredCandidates.length > 0 && (
            <div className="space-y-3">
              <SectionHeader
                title="Candidate Findings"
                subtitle="Entity, location, and event findings extracted from uploaded evidence"
              />
              <div className="space-y-3">
                {filteredCandidates.map((c) => {
                  const isConflict =
                    c.type === "LOCATION" ||
                    (c.description && c.description.toLowerCase().includes("conflict"));

                  return (
                    <div key={c.id} className="surface-elevated p-5 rounded-lg border border-border space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border rounded bg-background">
                              {isConflict ? "EVIDENCE CONFLICT" : c.type}
                            </span>
                            {c.status === "REJECTED" ? (
                              <span className="px-2 py-0.5 bg-status-rejected/20 text-status-rejected font-bold text-[10px] rounded uppercase tracking-wider">
                                REJECTED
                              </span>
                            ) : c.status === "VERIFIED" ? (
                              <span className="px-2 py-0.5 bg-status-verified/20 text-status-verified font-bold text-[10px] rounded uppercase tracking-wider">
                                APPROVED → TRUSTED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-accent/20 text-accent font-bold text-[10px] rounded uppercase tracking-wider">
                                PENDING
                              </span>
                            )}
                            <ConfidenceIndicator value={c.confidence} />
                          </div>
                          <h4 className="font-serif text-lg font-semibold text-foreground mt-2">{c.label}</h4>
                          {c.description && <p className="text-xs text-text-secondary mt-1">{c.description}</p>}
                        </div>
                      </div>

                      {c.sourceExcerpt && (
                        <div className="p-3 bg-background rounded border border-border/70 text-xs font-mono text-text-secondary">
                          <span className="text-[10px] text-text-muted font-sans font-medium uppercase tracking-wider block mb-1">
                            Extracted Source Excerpt:
                          </span>
                          "{c.sourceExcerpt}"
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                        <span className="text-text-muted">From: {c.evidence?.title || "Uploaded Document"}</span>
                        <div className="flex gap-2">
                          {isConflict && c.evidence && c.status === "PENDING" && (
                            <button
                              onClick={() =>
                                setComparisonData({
                                  itemA: c.evidence,
                                  itemB: {
                                    ...c.evidence,
                                    title: `${c.evidence.title} (Secondary Scan)`,
                                    rawContent: c.sourceExcerpt || c.evidence.rawContent,
                                  },
                                  conflictTitle: `Evidence Conflict: ${c.label}`,
                                  conflictReason: c.description || "Potential location or temporal discrepancy.",
                                  candidateId: c.id,
                                })
                              }
                              className="px-3 py-1.5 border border-accent/40 bg-accent/5 text-accent rounded font-medium hover:bg-accent/10 transition-colors"
                            >
                              Compare Evidence
                            </button>
                          )}
                          {c.status === "PENDING" ? (
                            <>
                              <button
                                onClick={() => handleCandidateAction(c.id, "verify")}
                                disabled={processingId === c.id}
                                className="px-4 py-1.5 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                              >
                                Verify
                              </button>
                              <button
                                onClick={() => handleCandidateAction(c.id, "reject")}
                                disabled={processingId === c.id}
                                className="px-4 py-1.5 border border-border rounded hover:border-border-strong text-text-secondary hover:text-foreground transition-colors disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-text-muted italic">Decision recorded in audit history</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evidence Comparison Modal */}
      {comparisonData && (
        <EvidenceComparisonModal
          itemA={comparisonData.itemA}
          itemB={comparisonData.itemB}
          conflictTitle={comparisonData.conflictTitle}
          conflictReason={comparisonData.conflictReason}
          onClose={() => setComparisonData(null)}
          onResolve={() => {
            if (comparisonData.candidateId) {
              return handleCandidateAction(comparisonData.candidateId, "verify");
            }
          }}
        />
      )}
    </div>
  );
}
