"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { ConfidenceIndicator } from "@/components/ui/common";

interface Candidate {
  id: string;
  type: string;
  status: string;
  label: string;
  description: string | null;
  confidence: number | null;
  sourceExcerpt: string | null;
  data: Record<string, unknown>;
  evidence: { title: string };
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadCandidates = () => {
    fetch(`/api/investigations/${id}/candidates`)
      .then((r) => r.json())
      .then((data) => {
        setCandidates(data.candidates || []);
        setLoading(false);
      });
  };

  useEffect(() => { loadCandidates(); }, [id]);

  const handleAction = async (candidateId: string, action: "verify" | "reject") => {
    setProcessing(candidateId);
    try {
      const res = await fetch(`/api/investigations/${id}/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      loadCandidates();
    } catch {
      alert("Failed to process candidate");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="p-8"><LoadingState /></div>;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <PageHeader
        title="Evidence review"
        description="Review candidate findings extracted from evidence. Verify or reject before adding to the investigation."
      />

      {candidates.length === 0 ? (
        <p className="text-sm text-text-muted">No pending candidates for review.</p>
      ) : (
        <div className="space-y-4">
          {candidates.map((c) => (
            <div key={c.id} className="surface-elevated p-5">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 border border-border rounded">{c.type}</span>
                    <ConfidenceIndicator value={c.confidence} />
                  </div>
                  <p className="font-medium mt-2">{c.label}</p>
                  {c.description && <p className="text-sm text-text-secondary mt-1">{c.description}</p>}
                </div>
              </div>

              {c.sourceExcerpt && (
                <div className="mt-3 p-3 bg-surface rounded border border-border">
                  <p className="text-xs text-text-muted mb-1">Source excerpt</p>
                  <p className="text-sm text-text-secondary">{c.sourceExcerpt}</p>
                </div>
              )}

              <p className="text-xs text-text-muted mt-2">From: {c.evidence.title}</p>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleAction(c.id, "verify")}
                  disabled={processing === c.id}
                  className="text-sm px-4 py-1.5 bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  onClick={() => handleAction(c.id, "reject")}
                  disabled={processing === c.id}
                  className="text-sm px-4 py-1.5 border border-border rounded hover:border-border-strong transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
