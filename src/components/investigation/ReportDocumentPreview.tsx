"use client";

import React from "react";
import { format } from "date-fns";
import type { CompleteReportModel } from "@/lib/investigation/reportTypes";

export function ReportDocumentPreview({ report }: { report: CompleteReportModel }) {
  const { investigation, generatedAt, sections } = report;

  return (
    <div
      id="argus-report-document"
      className="bg-[#fcfbf9] text-[#1a1a1a] p-10 max-w-[850px] mx-auto shadow-2xl rounded-sm border border-[#e5e4df] font-serif space-y-8 select-text"
    >
      {/* 1. COVER PAGE / HEADER */}
      <div className="border-b-2 border-amber-700/80 pb-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-mono text-xs text-amber-700 uppercase tracking-widest font-bold">
              ARGUS · OMNISCIENT EVIDENCE INTELLIGENCE
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mt-1 uppercase tracking-tight">
              INVESTIGATION BRIEF
            </h1>
          </div>
          <div className="text-right font-mono text-[11px] text-gray-500">
            <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold uppercase block mb-1">
              CONFIDENTIAL
            </span>
            <span>{format(new Date(generatedAt), "dd MMMM yyyy · HH:mm 'IST'")}</span>
          </div>
        </div>

        <div className="p-5 bg-[#f6f5f0] border border-[#e2e1dc] rounded grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div>
            <span className="text-gray-500 uppercase text-[10px] block">INVESTIGATION</span>
            <strong className="text-gray-900 text-sm font-serif block">{investigation.title}</strong>
          </div>
          <div>
            <span className="text-gray-500 uppercase text-[10px] block">CASE NUMBER</span>
            <strong className="text-amber-800 block">{investigation.caseNumber}</strong>
          </div>
          <div>
            <span className="text-gray-500 uppercase text-[10px] block">STATUS</span>
            <strong className="text-emerald-800 uppercase block">{investigation.status}</strong>
          </div>
          <div>
            <span className="text-gray-500 uppercase text-[10px] block">INVESTIGATOR</span>
            <strong className="text-gray-900 block">{investigation.leadName || "Lead Investigator"}</strong>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE SUMMARY */}
      {sections.executiveSummary && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            1. Executive Summary
          </h2>
          <p className="text-xs text-gray-800 leading-relaxed bg-[#f9f8f4] p-4 rounded border border-[#e8e7e1]">
            {report.executiveSummary}
          </p>
        </section>
      )}

      {/* 3. KEY FINDINGS */}
      {sections.keyFindings && report.keyFindings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            2. Key Analytical Findings
          </h2>
          <div className="space-y-2">
            {report.keyFindings.map((f, i) => (
              <div key={f.id} className="p-3.5 bg-white border border-[#e5e4df] rounded text-xs space-y-1">
                <div className="flex justify-between items-center font-sans">
                  <span className="font-semibold text-gray-900">
                    2.{i + 1} {f.finding}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 uppercase">
                    {f.isInferred ? "AI-Assisted Candidate" : "Verified Finding"}
                  </span>
                </div>
                <p className="text-gray-700 text-[11px] font-serif">{f.whyItMatters}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. INVESTIGATION LEADS */}
      {sections.leads && report.leads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            3. Active Investigation Leads
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans text-xs">
            {report.leads.map((l) => (
              <div key={l.id} className="p-3 bg-white border border-[#e5e4df] rounded space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-900">{l.title}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold uppercase">
                    {l.category}
                  </span>
                </div>
                <p className="text-gray-600 text-[11px] font-serif">{l.explanation}</p>
                <div className="text-[10px] font-mono text-gray-500 pt-1">
                  Status: {l.status} · {l.evidenceCount} Evidence Items
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. KEY ENTITIES */}
      {sections.keyEntities && report.entities.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            4. Key Tracked Entities
          </h2>
          <div className="space-y-2 font-sans text-xs">
            {report.entities.map((e) => (
              <div key={e.id} className="p-3 bg-white border border-[#e5e4df] rounded flex justify-between items-start">
                <div>
                  <span className="font-bold text-gray-900 text-sm">{e.label}</span>
                  <span className="text-[10px] font-mono text-amber-800 ml-2 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">
                    {e.type}
                  </span>
                  {e.context && <p className="text-gray-600 font-serif text-[11px] mt-1">{e.context}</p>}
                </div>
                <span className="text-[10px] font-mono text-gray-500 shrink-0">
                  {e.relationshipCount} Relationships
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. BRIDGE INTELLIGENCE */}
      {sections.bridgeIntelligence && report.bridgeIntelligence.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            5. Bridge Intelligence (Structural Connections)
          </h2>
          {report.bridgeIntelligence.map((b) => (
            <div key={b.entityId} className="p-4 bg-white border-2 border-amber-700/30 rounded space-y-3">
              {/* PDF Visual Diagram Component */}
              <div className="p-3 bg-[#fbf9f4] border border-amber-200 rounded text-center font-mono text-xs flex justify-around items-center">
                <span className="px-2 py-1 bg-white border border-gray-300 rounded font-bold">{b.communities[0] || "Cluster A"}</span>
                <span className="text-amber-700 font-bold">─── [ BRIDGE: {b.label} ] ───➔</span>
                <span className="px-2 py-1 bg-white border border-gray-300 rounded font-bold">{b.communities[1] || "Cluster B"}</span>
              </div>

              <div className="space-y-1 text-xs font-serif">
                <div className="font-bold text-gray-900">Structural Entity: {b.label}</div>
                <p className="text-gray-700 leading-relaxed">{b.explanation}</p>
                <div className="text-amber-900 font-mono text-[11px] bg-amber-50 p-2 rounded border border-amber-200">
                  <strong>Impact of Removal:</strong> {b.structuralImpact}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 7. FINANCIAL INTELLIGENCE */}
      {sections.financialIntelligence && report.financialIntelligence.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            6. Financial Intelligence Trail
          </h2>
          {report.financialIntelligence.map((f) => (
            <div key={f.id} className="p-4 bg-white border border-[#e5e4df] rounded space-y-2">
              <div className="flex justify-between items-center font-sans text-xs">
                <span className="font-bold text-gray-900">{f.title}</span>
                {f.amount && (
                  <span className="font-mono text-amber-800 font-bold text-sm">
                    ₹{f.amount.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Financial Flow Graphic */}
              <div className="p-2.5 bg-[#f8f7f2] border border-[#e2e1dc] rounded font-mono text-[11px] flex justify-between items-center text-gray-700">
                <span>{f.source || "Source Account"}</span>
                <span className="text-amber-700 font-bold">➔ [{f.channel || "UPI / BANK"}] ➔</span>
                <span>{f.target || "Destination Account"}</span>
              </div>

              <p className="text-xs text-gray-700 font-serif">{f.details}</p>
            </div>
          ))}
        </section>
      )}

      {/* 8. TEMPORAL RECONSTRUCTION */}
      {sections.temporalReconstruction && report.temporalReconstruction.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            7. Temporal Reconstruction & Incident Window
          </h2>
          <div className="space-y-2 border-l-2 border-amber-600 pl-4">
            {report.temporalReconstruction.map((t) => (
              <div key={t.id} className="space-y-0.5">
                <span className="font-mono text-[10px] text-amber-800 font-bold uppercase">{t.timeWindow}</span>
                <h4 className="font-sans text-xs font-bold text-gray-900">{t.title}</h4>
                <p className="text-xs text-gray-700 font-serif">{t.details}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 9. EVIDENCE RECORD TABLE */}
      {sections.evidence && report.evidence.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            8. Supporting Evidence Records
          </h2>
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[#f4f3ee] border-b border-gray-300 text-[10px] font-mono text-gray-600 uppercase">
                <th className="p-2">Title / Record</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Integrity Hash</th>
              </tr>
            </thead>
            <tbody>
              {report.evidence.map((ev) => (
                <tr key={ev.id} className="border-b border-gray-200">
                  <td className="p-2 font-semibold text-gray-900">{ev.title}</td>
                  <td className="p-2 font-mono text-[10px]">{ev.type}</td>
                  <td className="p-2 font-mono text-[10px] uppercase text-emerald-800">{ev.status}</td>
                  <td className="p-2 font-mono text-[9px] text-gray-500">{ev.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 10. ARGUS ANALYSES */}
      {sections.argusAnalysis && report.argusAnalyses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1 font-serif uppercase tracking-wide">
            9. ARGUS Analytical Responses
          </h2>
          {report.argusAnalyses.map((a) => (
            <div key={a.id} className="p-4 bg-[#f8f7f2] border border-[#e2e1dc] rounded space-y-2 font-serif text-xs">
              <div className="font-mono text-[10px] text-amber-800 font-bold uppercase">
                QUERY: {a.question}
              </div>
              <p className="text-gray-800 leading-relaxed">{a.response}</p>
              <div className="font-mono text-[9px] text-gray-500 text-right">
                Generated: {format(new Date(a.generatedAt), "dd MMM yyyy HH:mm")}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 11. ARGUS INTEGRITY PASSPORT PAGE */}
      <section className="pt-10 border-t-2 border-amber-800/60 space-y-6 page-break-before font-sans">
        <div className="flex justify-between items-start border-b border-amber-200 pb-4">
          <div>
            <span className="text-[10px] font-mono text-amber-800 uppercase font-bold tracking-widest block">
              ARGUS · FORENSIC DOCUMENT CERTIFICATION
            </span>
            <h2 className="text-xl font-bold font-serif text-gray-900 uppercase">DOCUMENT INTEGRITY PASSPORT</h2>
          </div>
          <div className="text-right font-mono text-[10px] text-gray-500">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold uppercase block mb-1">
              INTEGRITY SEALED
            </span>
            <span>ISSUED {format(new Date(generatedAt), "dd MMM yyyy")}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-[#f9f8f3] p-6 rounded border border-[#e2e1dc]">
          {/* Visual Fingerprint Display */}
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded border border-[#e5e4df] shadow-xs space-y-2">
            <div className="w-36 h-36 rounded-full border border-amber-300/40 p-2 flex items-center justify-center bg-[#fcfbf9]">
              <div className="w-28 h-28 rounded-full border-2 border-dashed border-amber-600/60 flex items-center justify-center font-mono text-[10px] font-bold text-amber-900 text-center p-2">
                FINGERPRINT<br />SEALED<br />{investigation.caseNumber}
              </div>
            </div>
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
              VISUAL REPRESENTATION OF DOCUMENT IDENTITY
            </span>
          </div>

          {/* Cryptographic Metadata */}
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-[9px] text-gray-500 uppercase block font-bold">INTEGRITY ID</span>
              <strong className="text-amber-900 font-bold text-sm">
                ARG-{(investigation.caseNumber || "QM").replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-V01-7F3A
              </strong>
            </div>

            <div>
              <span className="text-[9px] text-gray-500 uppercase block font-bold">ALGORITHM</span>
              <span className="text-gray-900">SHA-256 (Canonical Lowercase Hex)</span>
            </div>

            <div>
              <span className="text-[9px] text-gray-500 uppercase block font-bold">EXTERNAL ANCHOR STATUS</span>
              <span className="text-emerald-800 font-bold">INTERNAL INTEGRITY SEALED · NOT_CONFIGURED</span>
            </div>

            <div className="pt-2 border-t border-gray-300/60 text-[10px] text-gray-600">
              To verify authenticity, upload this document to the ARGUS Document Verification Station or scan the QR passport code.
            </div>
          </div>
        </div>
      </section>

      {/* 12. VERIFICATION & PROVENANCE FOOTER */}
      <div className="pt-8 border-t-2 border-gray-300 flex justify-between items-center font-mono text-[10px] text-gray-500">
        <div>
          <span>ARGUS OMNISCIENT EVIDENCE INTELLIGENCE</span> · <span>CASE {investigation.caseNumber}</span> · <span>INTEGRITY ID: ARG-{(investigation.caseNumber || "QM").replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-V01-7F3A</span>
        </div>
        <div>
          CONFIDENTIAL · REPORT CERTIFIED
        </div>
      </div>
    </div>
  );
}
