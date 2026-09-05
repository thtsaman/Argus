"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { ReportDocumentPreview } from "@/components/investigation/ReportDocumentPreview";
import type { CompleteReportModel } from "@/lib/investigation/reportTypes";
import { EMAIL_CONFIG } from "@/lib/emailConfig";

export default function InvestigationBriefWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<CompleteReportModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [recipient, setRecipient] = useState(EMAIL_CONFIG.DEFAULT_RECIPIENT);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const storageKey = "argus_brief_custom_findings";
      const customStr = localStorage.getItem(storageKey);
      const customContent = customStr ? JSON.parse(customStr) : {};

      const res = await fetch(`/api/investigations/${id}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customContent }),
      });
      const data = await res.json();
      setReport(data);
    } catch {
      console.error("Failed to load report model");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const toggleSection = (sectionKey: keyof CompleteReportModel["sections"]) => {
    if (!report) return;
    setReport({
      ...report,
      sections: {
        ...report.sections,
        [sectionKey]: !report.sections[sectionKey],
      },
    });
  };

  const generatePdfBlob = async (): Promise<{ doc: jsPDF; base64: string; filename: string }> => {
    const el = document.getElementById("argus-report-document");
    if (!el) throw new Error("Report element not found");

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#fcfbf9",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const safeTitle = (report?.investigation.title || "Question_Mark").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `ARGUS_Investigation_Brief_${safeTitle}_${new Date().toISOString().split("T")[0]}.pdf`;
    const base64 = pdf.output("datauristring");

    return { doc: pdf, base64, filename };
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const { doc, filename } = await generatePdfBlob();
      doc.save(filename);
    } catch (err: any) {
      alert("Failed to generate PDF: " + (err?.message || "Unknown error"));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const { base64, filename } = await generatePdfBlob();

      const res = await fetch(`/api/investigations/${id}/brief/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient,
          investigationTitle: report?.investigation.title,
          caseNumber: report?.investigation.caseNumber,
          pdfBase64: base64,
          filename,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Email delivery failed");
      }

      setEmailStatus({
        type: "success",
        message: `Investigation brief sent successfully to ${recipient} at ${new Date().toLocaleTimeString()}.`,
      });
    } catch (err: any) {
      setEmailStatus({
        type: "error",
        message: err?.message || "Unable to deliver email via SMTP server.",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Investigation Brief Workspace"
        description="Build, customize, preview, download, and email professional intelligence reports."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-surface-elevated text-xs font-semibold rounded shadow-2xs transition-colors"
            >
              {generatingPdf ? "Generating PDF..." : "DOWNLOAD PDF"}
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="px-4 py-2 border border-border bg-background hover:bg-surface text-foreground text-xs font-semibold rounded transition-colors"
            >
              SEND VIA EMAIL
            </button>
          </div>
        }
      />

      {/* 3-COLUMN WORKSPACE CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT RAIL: BRIEF CONTENTS CONTROL */}
        <div className="lg:col-span-3 surface-elevated p-4 rounded-lg border border-border space-y-4">
          <div className="border-b border-border pb-2">
            <h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">
              REPORT SECTIONS
            </h3>
            <p className="text-[10px] text-text-muted">Toggle sections to include in brief</p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {Object.entries(report.sections).map(([key, isEnabled]) => (
              <label
                key={key}
                className="flex items-center justify-between p-2 rounded hover:bg-surface cursor-pointer border border-transparent hover:border-border"
              >
                <span className="capitalize text-text-secondary">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleSection(key as keyof CompleteReportModel["sections"])}
                  className="accent-accent"
                />
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-border">
            <button
              onClick={() => {
                localStorage.removeItem("argus_brief_custom_findings");
                fetchReport();
              }}
              className="w-full text-center text-[10px] font-mono text-text-muted hover:text-accent underline"
            >
              Reset Custom Added Findings
            </button>
          </div>
        </div>

        {/* CENTER: REAL DOCUMENT PREVIEW */}
        <div className="lg:col-span-6 overflow-y-auto max-h-[85vh] p-2 surface rounded-lg border border-border">
          <ReportDocumentPreview report={report} />
        </div>

        {/* RIGHT RAIL: EXPORT & EMAIL ACTIONS */}
        <div className="lg:col-span-3 surface-elevated p-5 rounded-lg border border-border space-y-5">
          <div className="border-b border-border pb-2">
            <h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">
              EXPORT & SHARE
            </h3>
            <p className="text-[10px] text-text-muted">Server-side intelligence snapshot</p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-background rounded border border-border space-y-1">
              <span className="text-[10px] text-text-muted block uppercase">TARGET INVESTIGATION</span>
              <strong className="text-foreground block">{report.investigation.title}</strong>
              <span className="text-[10px] text-accent block font-bold">CASE ID: {report.investigation.caseNumber}</span>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="w-full py-2.5 bg-accent hover:bg-accent-hover text-surface-elevated font-semibold text-xs rounded shadow-2xs transition-colors block text-center"
            >
              {generatingPdf ? "Building PDF..." : "DOWNLOAD PDF REPORT"}
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className="w-full py-2.5 border border-border bg-background hover:bg-surface text-foreground font-semibold text-xs rounded transition-colors block text-center"
            >
              EMAIL BRIEF TO INVESTIGATOR
            </button>
          </div>
        </div>
      </div>

      {/* EMAIL TRANSMISSION MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="surface-elevated p-6 rounded-lg border border-border max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-start border-b border-border pb-2">
              <div>
                <span className="text-[10px] font-mono text-accent font-bold uppercase">SMTP TRANSMISSION</span>
                <h3 className="text-lg font-serif font-bold text-foreground">Send Investigation Brief</h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-text-muted hover:text-foreground text-xs font-mono">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">RECIPIENT EMAIL</label>
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">SUBJECT</label>
                <input
                  type="text"
                  readOnly
                  value={`ARGUS Investigation Brief — ${report.investigation.title}`}
                  className="w-full p-2 bg-background/50 border border-border rounded text-text-muted"
                />
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold block mb-1">ATTACHMENT</label>
                <div className="p-2 bg-background border border-border rounded text-accent font-bold text-[11px]">
                  ARGUS_Investigation_Brief_{report.investigation.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf
                </div>
              </div>
            </div>

            {emailStatus && (
              <div
                className={`p-3 rounded border text-xs font-mono ${
                  emailStatus.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800"
                    : "bg-red-500/10 border-red-500/30 text-red-800"
                }`}
              >
                {emailStatus.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-3 py-1.5 border border-border rounded text-xs font-mono hover:bg-surface"
              >
                CANCEL
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-surface-elevated font-semibold text-xs rounded transition-colors"
              >
                {sendingEmail ? "SENDING..." : "SEND BRIEF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
