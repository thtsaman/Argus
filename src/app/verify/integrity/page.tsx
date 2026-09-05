"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/common";
import { IntegrityFingerprint } from "@/components/integrity/IntegrityFingerprint";
import { formatDisplayHash } from "@/lib/integrity/hash";

export default function DocumentVerificationStationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [integrityIdInput, setIntegrityIdInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setVerifying(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    if (integrityIdInput.trim()) {
      formData.append("integrityId", integrityIdInput.trim());
    }

    try {
      const res = await fetch("/api/integrity/verify", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Verification failed");
        setResult(null);
        return;
      }
      setResult(data);
    } catch (err: any) {
      alert("Error uploading file: " + (err?.message || "Unknown error"));
      setResult({ status: "VERIFICATION_ERROR", error: "Failed to communicate with verification server" });
    } finally {
      setVerifying(false);
    }
  };

  const resetWorkspace = () => {
    setFile(null);
    setIntegrityIdInput("");
    setResult(null);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">
      <PageHeader
        title="Document Verification Station"
        description="Verify that an issued investigation brief matches its authoritative cryptographic integrity record."
      />

      {!result && (
        <div className="max-w-2xl mx-auto surface-elevated p-8 rounded-lg border border-border space-y-6 shadow-md">
          <div className="border-b border-border pb-3">
            <span className="text-[10px] font-mono text-accent font-bold uppercase tracking-wider block">
              ARGUS · INTEGRITY PASSPORT VERIFICATION
            </span>
            <h2 className="text-xl font-serif font-bold text-foreground">Upload Document Artifact</h2>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {/* File Dropzone */}
            <div className="border-2 border-dashed border-border hover:border-accent p-8 rounded-lg text-center bg-background/50 transition-colors">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                id="doc-upload"
                className="hidden"
              />
              <label htmlFor="doc-upload" className="cursor-pointer space-y-2 block">
                <div className="text-2xl">📄</div>
                <span className="text-xs font-mono font-bold text-foreground block">
                  {file ? file.name : "DROP PDF INVESTIGATION BRIEF HERE OR CLICK TO SELECT"}
                </span>
                <span className="text-[10px] font-mono text-text-muted block">
                  Supports official PDF documents (Max 100MB)
                </span>
              </label>
            </div>

            <div>
              <label className="text-[10px] font-mono text-text-muted uppercase font-bold block mb-1">
                INTEGRITY ID (OPTIONAL)
              </label>
              <input
                type="text"
                placeholder="e.g. ARG-QM-0042-V01-7F3A"
                value={integrityIdInput}
                onChange={(e) => setIntegrityIdInput(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded font-mono text-xs text-foreground focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={!file || verifying}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-surface-elevated font-mono font-bold text-xs rounded transition-colors uppercase"
            >
              {verifying ? "COMPUTING SHA-256 & VERIFYING..." : "VERIFY DOCUMENT INTEGRITY"}
            </button>
          </form>
        </div>
      )}

      {/* VERIFICATION RESULT STATE */}
      {result && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div
            className={`surface-elevated p-8 rounded-lg border shadow-lg space-y-6 ${
              result.match
                ? "border-emerald-600/40 bg-emerald-950/5"
                : "border-red-600/40 bg-red-950/5"
            }`}
          >
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-wider block">
                  FORENSIC VERIFICATION RESULT
                </span>
                <h2
                  className={`text-2xl font-serif font-bold uppercase ${
                    result.match ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {result.match
                    ? "INTEGRITY VERIFIED"
                    : result.status === "MISMATCH"
                    ? "INTEGRITY CHECK FAILED"
                    : "NO INTEGRITY RECORD FOUND"}
                </h2>
              </div>
              <span
                className={`px-3 py-1 rounded text-xs font-mono font-bold uppercase border ${
                  result.match
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                    : "bg-red-500/10 border-red-500/30 text-red-800"
                }`}
              >
                {result.status}
              </span>
            </div>

            {/* Side-by-side Fingerprint Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4 bg-background/50 p-6 rounded border border-border">
              <div className="flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-mono text-text-muted uppercase font-bold">
                  ISSUED FINGERPRINT
                </span>
                <IntegrityFingerprint
                  integrityId={result.issuedRecord?.integrityId || "UNKNOWN"}
                  fingerprintSeed={result.issuedRecord?.fingerprintSeed}
                  size={140}
                  variant={result.match ? "verified" : "mismatch"}
                />
                <span className="text-[10px] font-mono text-text-secondary truncate max-w-[200px]">
                  {result.issuedRecord?.integrityId || "N/A"}
                </span>
              </div>

              <div className="flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-mono text-text-muted uppercase font-bold">
                  RECEIVED FINGERPRINT
                </span>
                <IntegrityFingerprint
                  integrityId={result.issuedRecord?.integrityId || "RECEIVED"}
                  fingerprintSeed={`RECEIVED-${result.receivedHash?.slice(0, 16)}`}
                  size={140}
                  variant={result.match ? "verified" : "mismatch"}
                />
                <span className="text-[10px] font-mono text-text-secondary truncate max-w-[200px]">
                  RECEIVED SHA-256
                </span>
              </div>
            </div>

            {/* Cryptographic Details */}
            <div className="space-y-3 font-mono text-xs bg-background p-4 rounded border border-border">
              <div>
                <span className="text-[10px] text-text-muted uppercase block font-bold">RECEIVED FILE SHA-256</span>
                <code className="text-foreground text-[11px] block break-all font-bold">
                  {formatDisplayHash(result.receivedHash)}
                </code>
              </div>

              {result.issuedHash && (
                <div>
                  <span className="text-[10px] text-text-muted uppercase block font-bold">ISSUED RECORD SHA-256</span>
                  <code className="text-accent text-[11px] block break-all font-bold">
                    {formatDisplayHash(result.issuedHash)}
                  </code>
                </div>
              )}

              <p className="text-text-secondary text-[11px] font-serif pt-2 border-t border-border">
                {result.match
                  ? "The received document SHA-256 checksum exactly matches the issued artifact stored in the ARGUS Integrity Registry."
                  : "The received document checksum does not match the fingerprint issued for this document version. The file representation has been altered after issuance."}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={resetWorkspace}
                className="px-5 py-2 bg-accent hover:bg-accent-hover text-surface-elevated font-mono font-bold text-xs rounded transition-colors uppercase"
              >
                VERIFY ANOTHER DOCUMENT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
