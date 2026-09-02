"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { EvidenceDetailModal, type EvidenceRecordItem } from "@/components/investigation/EvidenceDetailModal";
import { format } from "date-fns";

export default function EvidenceLibraryPage() {
  const { id } = useParams<{ id: string }>();
  const [evidenceList, setEvidenceList] = useState<EvidenceRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecordItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch(`/api/investigations/${id}/evidence`)
      .then((r) => r.json())
      .then((data) => {
        setEvidenceList(data.evidence || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const filteredEvidence = evidenceList.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.fileName && item.fileName.toLowerCase().includes(q)) ||
      (item.source && item.source.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXTRACTED":
      case "READY":
        return (
          <span className="px-2 py-0.5 bg-status-verified/20 text-status-verified font-bold text-[10px] rounded uppercase tracking-wider">
            READY
          </span>
        );
      case "PROCESSING":
        return (
          <span className="px-2 py-0.5 bg-accent/20 text-accent font-bold text-[10px] rounded uppercase tracking-wider animate-pulse">
            PROCESSING
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2 py-0.5 bg-status-rejected/20 text-status-rejected font-bold text-[10px] rounded uppercase tracking-wider">
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-surface text-text-secondary border border-border font-bold text-[10px] rounded uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1100px] mx-auto">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6" suppressHydrationWarning>
      <PageHeader
        title="EVIDENCE LIBRARY"
        description="Inspect and browse all ingested evidence files attached to this investigation."
      />

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by filename or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs border border-border rounded px-3 py-2 bg-surface text-foreground placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>
        <span className="text-xs text-text-muted">
          Showing {filteredEvidence.length} of {evidenceList.length} evidence items
        </span>
      </div>

      {/* Evidence Table / Cards */}
      {filteredEvidence.length === 0 ? (
        <div className="p-8 text-center surface rounded-lg border border-border">
          <p className="text-sm text-text-muted">
            {searchQuery ? "No evidence matching search query." : "No evidence items found in library. Use Evidence Intake to upload files."}
          </p>
        </div>
      ) : (
        <div className="surface-elevated border border-border rounded-lg overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-background/60 text-text-secondary font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredEvidence.map((item) => {
                  const ext = (item.fileName || item.title).split(".").pop()?.toUpperCase() || "TXT";
                  const dateStr = item.uploadedAt
                    ? format(new Date(item.uploadedAt), "dd MMM yyyy, HH:mm")
                    : "—";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-background/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedEvidence(item)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-foreground block truncate max-w-xs" title={item.fileName || item.title}>
                          {item.fileName || item.title}
                        </span>
                        {item.source && (
                          <span className="text-[10px] text-text-muted block mt-0.5">
                            Source: {item.source}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-text-secondary">
                        {ext}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3 px-4 text-text-muted font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedEvidence(item)}
                          className="px-3 py-1 bg-surface hover:bg-background border border-border rounded text-xs text-foreground font-medium transition-colors"
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for opening preview & source provenance */}
      {selectedEvidence && (
        <EvidenceDetailModal
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </div>
  );
}
