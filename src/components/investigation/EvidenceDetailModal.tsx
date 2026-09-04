"use client";

import { useState } from "react";
import { format } from "date-fns";

export interface EvidenceRecordItem {
  id: string;
  investigationId: string;
  title: string;
  fileName?: string | null;
  mimeType?: string | null;
  status: string;
  source?: string | null;
  rawContent?: string | null;
  uploadedAt: string | Date;
  processedAt?: string | Date | null;
  metadata?: Record<string, unknown> | null;
  blockchainStatus?: string | null;
  blockchainHash?: string | null;
  blockchainTxHash?: string | null;
  blockchainBlock?: number | null;
  blockchainAnchoredAt?: string | Date | null;
}

interface EvidenceDetailModalProps {
  evidence: EvidenceRecordItem;
  onClose: () => void;
}

export function EvidenceDetailModal({ evidence, onClose }: EvidenceDetailModalProps) {
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const uploadedDate = new Date(evidence.uploadedAt);
  const formattedUploadDate = isNaN(uploadedDate.getTime())
    ? "Unknown"
    : format(uploadedDate, "dd MMM yyyy, HH:mm");

  const ext = (evidence.fileName || evidence.title).split(".").pop()?.toUpperCase() || "TXT";

  const blockchainStatus = evidence.blockchainStatus || "NOT ANCHORED";
  const blockchainStatusLabel = blockchainStatus === "PENDING"
    ? "Blockchain anchoring in progress"
    : blockchainStatus === "FAILED"
      ? "Blockchain anchoring unavailable"
      : blockchainStatus === "ANCHORED"
        ? "ANCHORED ✓"
        : "Blockchain integrity not anchored";
  const blockchainStatusClass = blockchainStatus === "ANCHORED"
    ? "bg-status-verified/20 text-status-verified"
    : blockchainStatus === "FAILED"
      ? "bg-status-rejected/20 text-status-rejected"
      : "bg-accent/15 text-accent";

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be unavailable in non-secure browser contexts.
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationStatus(null);
    setVerificationMessage(null);
    try {
      const response = await fetch(
        `/api/investigations/${evidence.investigationId}/evidence/${evidence.id}/verify`,
        { method: "POST" },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("Verification unavailable");
      setVerificationStatus(result.status);
      setVerificationMessage(
        result.status === "INTEGRITY_VERIFIED"
          ? "The current evidence file matches the hash anchored on the blockchain."
          : result.status === "INTEGRITY_VIOLATION"
            ? "The current evidence file does not match the hash anchored on the blockchain."
            : "Blockchain integrity is not anchored for this evidence.",
      );
    } catch {
      setVerificationStatus("UNAVAILABLE");
      setVerificationMessage("Unable to verify integrity right now.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Map EvidenceStatus enum to clean UI states
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "EXTRACTED":
      case "READY":
        return (
          <span className="px-2.5 py-0.5 bg-status-verified/20 text-status-verified font-bold text-xs rounded uppercase tracking-wider">
            READY
          </span>
        );
      case "PROCESSING":
        return (
          <span className="px-2.5 py-0.5 bg-accent/20 text-accent font-bold text-xs rounded uppercase tracking-wider animate-pulse">
            PROCESSING
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2.5 py-0.5 bg-status-rejected/20 text-status-rejected font-bold text-xs rounded uppercase tracking-wider">
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 bg-surface text-text-secondary border border-border font-bold text-xs rounded uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="surface-elevated rounded-lg border border-border max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 bg-background border border-border rounded text-text-secondary uppercase">
                {ext}
              </span>
              {getStatusBadge(evidence.status)}
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground break-all">
              {evidence.fileName || evidence.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-foreground text-sm p-1.5 rounded hover:bg-surface border border-border transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Source Provenance metadata */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-background rounded-lg border border-border text-xs">
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Original Filename
              </span>
              <span className="text-foreground font-medium truncate block mt-0.5" title={evidence.fileName || evidence.title}>
                {evidence.fileName || evidence.title}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Upload Date
              </span>
              <span className="text-foreground font-medium block mt-0.5">
                {formattedUploadDate}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Evidence ID
              </span>
              <span className="text-foreground font-mono text-[11px] truncate block mt-0.5" title={evidence.id}>
                {evidence.id}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase tracking-wider font-semibold">
                Investigation ID
              </span>
              <span className="text-foreground font-mono text-[11px] truncate block mt-0.5" title={evidence.investigationId}>
                {evidence.investigationId}
              </span>
            </div>
          </div>

          {/* Extracted Text Content Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Extracted Text / Prepared Content Preview
              </h4>
              <span className="text-[11px] text-text-muted">
                {evidence.rawContent ? `${evidence.rawContent.length} characters` : "No preview available"}
              </span>
            </div>

            {evidence.rawContent ? (
              <div className="p-4 bg-background border border-border rounded-lg max-h-[320px] overflow-y-auto font-mono text-xs text-text-secondary leading-relaxed whitespace-pre-wrap select-text">
                {evidence.rawContent}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-lg bg-background/50">
                <p className="text-xs text-text-muted">
                  No text preview is available for this evidence item.
                </p>
              </div>
            )}

            <section className="space-y-3 p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Blockchain Integrity
                </h4>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${blockchainStatusClass}`}>
                  {blockchainStatus === "ANCHORED" ? "ANCHORED ✓" : blockchainStatus}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">{blockchainStatusLabel}</p>

              {evidence.blockchainHash && (
                <div className="space-y-1">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">SHA-256</span>
                  <div className="flex items-start gap-2">
                    <code className="min-w-0 flex-1 break-all rounded border border-border/60 bg-surface p-2 text-[11px] text-text-secondary select-text">
                      {evidence.blockchainHash}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyValue(evidence.blockchainHash!)}
                      className="shrink-0 px-2 py-1 rounded border border-border text-[10px] text-text-secondary hover:text-foreground hover:bg-surface"
                      title="Copy SHA-256 hash"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {evidence.blockchainStatus === "ANCHORED" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block">Transaction</span>
                    {evidence.blockchainTxHash ? (
                      <div className="flex items-center gap-2 mt-1">
                        <code className="min-w-0 flex-1 truncate text-[11px] text-text-secondary" title={evidence.blockchainTxHash}>
                          {evidence.blockchainTxHash}
                        </code>
                        <button type="button" onClick={() => copyValue(evidence.blockchainTxHash!)} className="shrink-0 text-[10px] text-accent hover:text-accent-hover" title="Copy transaction hash">
                          Copy
                        </button>
                      </div>
                    ) : <span className="text-text-muted">Unavailable</span>}
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block">Block</span>
                    <span className="text-text-secondary font-mono text-[11px] block mt-1">{evidence.blockchainBlock ?? "Unavailable"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold block">Anchored</span>
                    <span className="text-text-secondary text-[11px] block mt-1">
                      {evidence.blockchainAnchoredAt ? format(new Date(evidence.blockchainAnchoredAt), "dd MMM yyyy, HH:mm") : "Unavailable"}
                    </span>
                  </div>
                </div>
              )}

              {evidence.blockchainTxHash && evidence.blockchainStatus === "ANCHORED" && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${evidence.blockchainTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-[11px] text-accent hover:text-accent-hover underline underline-offset-2"
                >
                  View on Sepolia Etherscan
                </a>
              )}

              <div className="pt-1 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={isVerifying || evidence.blockchainStatus !== "ANCHORED"}
                  className="px-3 py-1.5 bg-accent text-surface-elevated rounded text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? "Verifying integrity..." : "Verify Integrity"}
                </button>
                {verificationStatus && (
                  <span className={`text-xs font-semibold ${verificationStatus === "INTEGRITY_VERIFIED" ? "text-status-verified" : "text-status-rejected"}`}>
                    {verificationStatus === "INTEGRITY_VERIFIED" ? "✓ INTEGRITY VERIFIED" : verificationStatus}
                  </span>
                )}
              </div>
              {verificationMessage && (
                <p className={`text-xs ${verificationStatus === "INTEGRITY_VERIFIED" ? "text-status-verified" : "text-status-rejected"}`}>
                  {verificationMessage}
                </p>
              )}
            </section>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-5 py-2 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
