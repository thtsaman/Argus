"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/common";
import { IntegrityFingerprint } from "@/components/integrity/IntegrityFingerprint";
import { formatDisplayHash } from "@/lib/integrity/hash";

type VerificationStepId =
  | "DOCUMENT_RECEIVED"
  | "READING_ARTIFACT"
  | "COMPUTING_SHA256"
  | "RECONSTRUCTING_IDENTITY"
  | "RETRIEVING_RECORD"
  | "COMPARING_FINGERPRINTS"
  | "VERIFICATION_COMPLETE";

interface LedgerStep {
  id: string;
  label: string;
  status: "pending" | "active" | "success" | "error";
}

const STEP_LABELS: Record<VerificationStepId, string> = {
  DOCUMENT_RECEIVED: "DOCUMENT RECEIVED",
  READING_ARTIFACT: "READING ARTIFACT",
  COMPUTING_SHA256: "COMPUTING SHA-256",
  RECONSTRUCTING_IDENTITY: "RECONSTRUCTING DOCUMENT IDENTITY",
  RETRIEVING_RECORD: "RETRIEVING ISSUED RECORD",
  COMPARING_FINGERPRINTS: "CRYPTOGRAPHIC COMPARISON",
  VERIFICATION_COMPLETE: "INTEGRITY VERIFIED",
};

export default function DocumentVerificationStationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [integrityIdInput, setIntegrityIdInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Animation states
  const [currentStep, setCurrentStep] = useState<VerificationStepId>("DOCUMENT_RECEIVED");
  const [reconstructionProgress, setReconstructionProgress] = useState(0);
  const [animatedHash, setAnimatedHash] = useState("");
  const [ledger, setLedger] = useState<LedgerStep[]>([]);
  const [animStage, setAnimStage] = useState<"idle" | "animating" | "complete">("idle");
  const [activeAnnotation, setActiveAnnotation] = useState<string>("DOCUMENT IDENTITY READING");

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
    setAnimStage("animating");
    setReconstructionProgress(0);
    setAnimatedHash("");

    const initialLedger: LedgerStep[] = [
      { id: "01", label: "ARTIFACT READ", status: "pending" },
      { id: "02", label: "SHA-256 COMPUTED", status: "pending" },
      { id: "03", label: "RECORD LOCATED", status: "pending" },
      { id: "04", label: "FINGERPRINT RECONSTRUCTED", status: "pending" },
      { id: "05", label: "COMPARISON", status: "pending" },
      { id: "06", label: "MATCH CONFIRMED", status: "pending" },
    ];
    setLedger(initialLedger);

    const formData = new FormData();
    formData.append("file", file);
    if (integrityIdInput.trim()) {
      formData.append("integrityId", integrityIdInput.trim());
    }

    try {
      // Execute real backend API verification
      const res = await fetch("/api/integrity/verify", {
        method: "POST",
        body: formData,
      });
      const apiData = await res.json();
      if (!res.ok) {
        alert(apiData.error || "Verification failed");
        setVerifying(false);
        setAnimStage("idle");
        return;
      }

      // Check prefers-reduced-motion
      const prefersReducedMotion =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        setResult(apiData);
        setReconstructionProgress(100);
        setAnimatedHash(apiData.receivedHash || "");
        setAnimStage("complete");
        setVerifying(false);
        return;
      }

      // --- RUN CONTROLLED DELIBERATE FORENSIC ANIMATION SEQUENCE (~5 seconds) ---
      const updateLedgerStep = (stepIdx: number, status: "success" | "error" | "active") => {
        setLedger((prev) =>
          prev.map((item, idx) => (idx === stepIdx ? { ...item, status } : item))
        );
      };

      // 0.0s: DOCUMENT RECEIVED & READING ARTIFACT
      setCurrentStep("READING_ARTIFACT");
      updateLedgerStep(0, "active");
      setActiveAnnotation("DOCUMENT IDENTITY READING");
      await new Promise((r) => setTimeout(r, 500));
      updateLedgerStep(0, "success");

      // 1.2s: COMPUTING SHA-256 (Hash scrambling resolution)
      setCurrentStep("COMPUTING_SHA256");
      updateLedgerStep(1, "active");
      setActiveAnnotation("COMPUTING HASH CHECKSUM");
      const targetHash = apiData.receivedHash || "0000000000000000000000000000000000000000000000000000000000000000";
      for (let i = 1; i <= 6; i++) {
        const scramble = targetHash
          .split("")
          .map((ch, idx) => (idx < (targetHash.length * i) / 6 ? ch : Math.floor(Math.random() * 16).toString(16)))
          .join("");
        setAnimatedHash(scramble);
        await new Promise((r) => setTimeout(r, 120));
      }
      setAnimatedHash(targetHash);
      updateLedgerStep(1, "success");

      // 2.0s: RETRIEVING ISSUED RECORD
      setCurrentStep("RETRIEVING_RECORD");
      updateLedgerStep(2, "active");
      setActiveAnnotation("SEARCHING INTEGRITY REGISTRY");
      await new Promise((r) => setTimeout(r, 600));
      updateLedgerStep(2, apiData.issuedRecord ? "success" : "error");

      // 2.5s: RECONSTRUCTING FINGERPRINT (Progressive SVG Path & Contour Reveal)
      setCurrentStep("RECONSTRUCTING_IDENTITY");
      updateLedgerStep(3, "active");
      setActiveAnnotation("RECONSTRUCTING GEOMETRIC IDENTITY");
      for (let p = 0; p <= 100; p += 10) {
        setReconstructionProgress(p);
        await new Promise((r) => setTimeout(r, 90));
      }
      updateLedgerStep(3, "success");

      // 4.0s: CRYPTOGRAPHIC COMPARISON
      setCurrentStep("COMPARING_FINGERPRINTS");
      updateLedgerStep(4, "active");
      setActiveAnnotation("COMPARING FINGERPRINT CONTOURS");
      await new Promise((r) => setTimeout(r, 800));
      updateLedgerStep(4, apiData.match ? "success" : "error");

      // 5.0s: MATCH CONFIRMED / DIVERGENCE DETECTED
      if (apiData.match) {
        updateLedgerStep(5, "success");
        setActiveAnnotation("IDENTICAL CHECKSUM & GEOMETRY");
      } else {
        setLedger((prev) =>
          prev.map((item, idx) => (idx === 5 ? { id: "06", label: "DIVERGENCE DETECTED", status: "error" } : item))
        );
        setActiveAnnotation("CHECKSUM DIVERGENCE DETECTED");
      }

      setResult(apiData);
      setAnimStage("complete");
    } catch (err: any) {
      alert("Error uploading file: " + (err?.message || "Unknown error"));
      setAnimStage("idle");
    } finally {
      setVerifying(false);
    }
  };

  const resetWorkspace = () => {
    setFile(null);
    setIntegrityIdInput("");
    setResult(null);
    setAnimStage("idle");
    setReconstructionProgress(0);
    setAnimatedHash("");
    setLedger([]);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-8 relative select-text">
      {/* SUBTLE SECURITY-PAPER BACKGROUND GUILLOCHE OVERLAY */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.025] bg-[radial-gradient(#92400e_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* HEADER SECTION */}
      <div className="border-b border-border pb-4">
        <span className="text-[10px] font-mono text-accent font-bold uppercase tracking-widest block mb-1">
          ARGUS · CRYPTOGRAPHIC ANALYSIS INSTRUMENT
        </span>
        <PageHeader
          title="Document Verification Station"
          description="Verify that an issued investigation brief matches its authoritative cryptographic integrity record."
        />
      </div>

      {/* 1. INITIAL UPLOAD FORM (When idle and no active result) */}
      {animStage === "idle" && !result && (
        <div className="max-w-2xl mx-auto surface-elevated p-8 rounded border border-border space-y-6">
          <div className="border-b border-border pb-3 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-mono text-accent font-bold uppercase tracking-wider block">
                FORENSIC ARTIFACT INGESTION
              </span>
              <h2 className="text-lg font-serif font-bold text-foreground">Upload Document Artifact</h2>
            </div>
            <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded bg-background border border-border">
              OFFICIAL VERIFICATION
            </span>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {/* File Dropzone */}
            <div className="border border-dashed border-border hover:border-accent p-8 rounded text-center bg-background/40 transition-colors">
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
              className="w-full py-3 bg-accent hover:bg-accent-hover text-surface-elevated font-mono font-bold text-xs rounded transition-colors uppercase tracking-wider"
            >
              INITIATE FORENSIC VERIFICATION
            </button>
          </form>
        </div>
      )}

      {/* 2. LIVE FORENSIC ANIMATION SEQUENCE & COMPARISON WORKSPACE */}
      {(animStage === "animating" || result) && (
        <div className="max-w-4xl mx-auto space-y-8">
          {/* MAIN VERIFICATION CONTAINER */}
          <div
            className={`surface-elevated p-8 rounded border shadow-xs space-y-8 transition-all ${
              result
                ? result.match
                  ? "border-emerald-800/40 bg-emerald-950/5"
                  : result.status === "MISMATCH"
                  ? "border-red-800/40 bg-red-950/5"
                  : "border-amber-800/40 bg-amber-950/5"
                : "border-amber-800/30 bg-amber-950/5"
            }`}
          >
            {/* FORENSIC HEADER & REFINED VALIDATION BADGE */}
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-mono text-text-muted uppercase font-bold tracking-widest block mb-0.5">
                  ARGUS · FORENSIC DOCUMENT VERIFICATION
                </span>
                <h2
                  className={`text-2xl font-serif font-bold uppercase ${
                    result
                      ? result.match
                        ? "text-emerald-800"
                        : result.status === "MISMATCH"
                        ? "text-red-800"
                        : "text-amber-800"
                      : "text-amber-800"
                  }`}
                >
                  {result
                    ? result.match
                      ? "INTEGRITY VERIFIED"
                      : result.status === "MISMATCH"
                      ? "INTEGRITY CHECK FAILED"
                      : "NO INTEGRITY RECORD FOUND"
                    : STEP_LABELS[currentStep]}
                </h2>
                <p className="text-xs text-text-secondary font-serif mt-1">
                  {result
                    ? result.match
                      ? "The received document matches the authoritative cryptographic record issued by ARGUS."
                      : result.status === "MISMATCH"
                      ? "The received document checksum does not match the fingerprint issued for this document version."
                      : "ARGUS could not locate an issued integrity record for this document."
                    : "Executing automated cryptographic inspection and identity reconstruction..."}
                </p>
              </div>

              {/* REFINED TECHNICAL BADGE */}
              <div className="text-right font-mono">
                <span
                  className={`px-3 py-1 rounded text-xs font-bold uppercase border inline-flex items-center gap-1.5 ${
                    result
                      ? result.match
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                        : "bg-red-500/10 border-red-500/30 text-red-800"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {result ? (result.match ? "● VALID" : result.status) : "● EXAMINING"}
                </span>
                <span className="text-[9px] text-text-muted block mt-1 uppercase font-bold">
                  {result ? (result.match ? "VERIFIED SHA-256 MATCH" : "AUTHENTICITY STATUS") : "CRYPTOGRAPHIC ANALYSIS"}
                </span>
              </div>
            </div>

            {/* INTEGRATED TWO-STAGE FINGERPRINT COMPARISON AREA */}
            <div className="bg-background/60 p-6 rounded border border-border relative space-y-4">
              <div className="flex justify-between items-center border-b border-border/40 pb-2 font-mono text-[10px] text-text-muted">
                <span>STAGE: FINGERPRINT RECONSTRUCTION</span>
                <span className="text-accent font-bold uppercase">{activeAnnotation}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-4 relative">
                {/* ISSUED REFERENCE FINGERPRINT */}
                <div className="flex flex-col items-center text-center space-y-3 relative">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-text-muted uppercase font-bold tracking-wider">
                      ISSUED REFERENCE FINGERPRINT
                    </span>
                    <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                      AUTHORITATIVE
                    </span>
                  </div>

                  <div className="p-4 bg-surface rounded border border-border relative shadow-2xs">
                    <IntegrityFingerprint
                      integrityId={result?.issuedRecord?.integrityId || integrityIdInput || "AUTHORITATIVE-REF"}
                      fingerprintSeed={result?.issuedRecord?.fingerprintSeed}
                      size={160}
                      variant={result ? (result.match ? "verified" : "mismatch") : "default"}
                      progress={100}
                    />
                    {/* Micro Annotation */}
                    <div className="absolute top-2 right-2 text-[8px] font-mono text-text-muted uppercase">
                      REF-01
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-text-secondary truncate max-w-[220px]">
                    {result?.issuedRecord?.integrityId || "ARGUS INTEGRITY REGISTRY"}
                  </span>
                </div>

                {/* CENTRAL CRYPTOGRAPHIC CONNECTOR & COMPARISON INDICATOR */}
                <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-10">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="w-16 h-px bg-border/80" />
                    <div
                      className={`px-3 py-1 rounded border font-mono text-[10px] font-bold uppercase transition-all shadow-2xs ${
                        result
                          ? result.match
                            ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                            : "bg-red-100 border-red-400 text-red-900"
                          : currentStep === "COMPARING_FINGERPRINTS"
                          ? "bg-amber-100 border-amber-400 text-amber-900 animate-pulse"
                          : "bg-surface border-border text-text-muted"
                      }`}
                    >
                      {result
                        ? result.match
                          ? "✓ MATCH CONFIRMED"
                          : "! MISMATCH DETECTED"
                        : currentStep === "COMPARING_FINGERPRINTS"
                        ? "COMPARING..."
                        : "RECONSTRUCTING"}
                    </div>
                    <div className="w-16 h-px bg-border/80" />
                  </div>
                </div>

                {/* RECEIVED ARTIFACT FINGERPRINT */}
                <div className="flex flex-col items-center text-center space-y-3 relative">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-text-muted uppercase font-bold tracking-wider">
                      RECEIVED ARTIFACT FINGERPRINT
                    </span>
                    <span className="text-[9px] font-mono text-accent bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                      INSPECTED
                    </span>
                  </div>

                  <div className="p-4 bg-surface rounded border border-border relative shadow-2xs">
                    <IntegrityFingerprint
                      integrityId={result?.issuedRecord?.integrityId || "RECEIVED-ARTIFACT"}
                      fingerprintSeed={`RECEIVED-${(result?.receivedHash || animatedHash || "SEED").slice(0, 16)}`}
                      size={160}
                      variant={result ? (result.match ? "verified" : "mismatch") : "default"}
                      progress={reconstructionProgress}
                      scanLine={animStage === "animating"}
                    />
                    {/* Micro Annotation */}
                    <div className="absolute top-2 right-2 text-[8px] font-mono text-text-muted uppercase">
                      INSPECT-02
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-accent font-bold uppercase truncate max-w-[220px]">
                    {reconstructionProgress < 100
                      ? `RECONSTRUCTING ${reconstructionProgress}%`
                      : result?.match
                      ? "GEOMETRY STABLE · VALID"
                      : result
                      ? "GEOMETRY DIVERGED"
                      : "FINGERPRINT RECONSTRUCTED"}
                  </span>
                </div>
              </div>
            </div>

            {/* DUAL TECHNICAL PANELS FOR HASH COMPARISON */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              {/* RECEIVED FILE SHA-256 PANEL */}
              <div className="p-4 bg-background rounded border border-border space-y-1">
                <div className="flex justify-between items-center border-b border-border/40 pb-1 mb-1">
                  <span className="text-[10px] text-text-muted uppercase font-bold">RECEIVED FILE SHA-256</span>
                  <span className="text-[9px] text-accent font-bold">COMPUTED</span>
                </div>
                <code className="text-foreground text-[11px] block break-all font-bold">
                  {formatDisplayHash(result?.receivedHash || animatedHash || "")}
                </code>
              </div>

              {/* ISSUED RECORD SHA-256 PANEL */}
              <div className="p-4 bg-background rounded border border-border space-y-1">
                <div className="flex justify-between items-center border-b border-border/40 pb-1 mb-1">
                  <span className="text-[10px] text-text-muted uppercase font-bold">ISSUED RECORD SHA-256</span>
                  <span className="text-[9px] text-emerald-800 font-bold">REGISTRY</span>
                </div>
                <code className="text-accent text-[11px] block break-all font-bold">
                  {result?.issuedHash ? formatDisplayHash(result.issuedHash) : result ? "NO RECORD FOUND" : "RETRIEVING..."}
                </code>
              </div>
            </div>

            {/* ACTION FOOTER */}
            {result && (
              <div className="flex justify-end items-center gap-3 pt-2 border-t border-border/40">
                <button
                  onClick={(e) => handleVerify(e as any)}
                  disabled={verifying}
                  className="px-5 py-2 border border-border bg-surface hover:bg-background text-foreground font-mono font-bold text-xs rounded transition-colors uppercase tracking-wider shadow-2xs"
                >
                  RE-VERIFY ARTIFACT
                </button>
                <button
                  onClick={resetWorkspace}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-surface-elevated font-mono font-bold text-xs rounded transition-colors uppercase tracking-wider shadow-2xs"
                >
                  VERIFY ANOTHER DOCUMENT
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
