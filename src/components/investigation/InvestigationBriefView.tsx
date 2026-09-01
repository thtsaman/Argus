"use client";

import { useState } from "react";
import { format } from "date-fns";

export interface InvestigationBriefData {
  investigation: {
    id: string;
    title: string;
    caseNumber: string;
    status: string;
    startDate?: string | null;
    endDate?: string | null;
    leadName?: string | null;
  };
  executiveSummary: string;
  keyFindings: {
    id: string;
    finding: string;
    whyItMatters: string;
    status: string;
    isInferred: boolean;
  }[];
  leads: {
    id: string;
    title: string;
    category: string;
    status: string;
    evidenceCount: number;
  }[];
  entities: {
    id: string;
    label: string;
    type: string;
    relationshipCount: number;
  }[];
  relationships: {
    id: string;
    source: string;
    target: string;
    type: string;
    status: string;
  }[];
  evidenceSummary: {
    total: number;
    extracted: number;
    pending: number;
  };
  verificationStats: {
    verified: number;
    underReview: number;
    rejected: number;
    aiSuggested: number;
  };
  recentEvents: {
    id: string;
    title: string;
    date: string;
  }[];
}

export function InvestigationBriefView({ data }: { data: InvestigationBriefData }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
  };

  return (
    <div className="surface-elevated p-8 rounded-lg border border-border space-y-8 print:p-0 print:border-none print:shadow-none max-w-[1000px] mx-auto">
      {/* Header & Export bar */}
      <div className="flex justify-between items-start border-b border-border pb-6">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-accent px-2 py-0.5 border border-accent/30 rounded bg-accent/5">
            Official Investigation Brief
          </span>
          <h1 className="font-serif text-2xl font-bold text-foreground mt-2">
            {data.investigation.title}
          </h1>
          <p className="text-xs text-text-muted mt-1 font-mono">
            Case Number: {data.investigation.caseNumber} · Generated {format(new Date(), "dd MMM yyyy HH:mm")}
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="print:hidden text-xs py-2 px-4 bg-accent text-surface-elevated font-medium rounded hover:bg-accent-hover transition-colors shadow-2xs"
        >
          Export / Print Brief
        </button>
      </div>

      {/* Scope Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 surface rounded border border-border text-xs">
        <div>
          <span className="text-text-muted block text-[10px] uppercase font-semibold">Status:</span>
          <span className="font-semibold text-foreground uppercase">{data.investigation.status}</span>
        </div>
        <div>
          <span className="text-text-muted block text-[10px] uppercase font-semibold">Lead Investigator:</span>
          <span className="font-semibold text-foreground">{data.investigation.leadName || "Unassigned"}</span>
        </div>
        <div>
          <span className="text-text-muted block text-[10px] uppercase font-semibold">Time Range:</span>
          <span className="font-semibold text-foreground font-mono">
            {data.investigation.startDate
              ? format(new Date(data.investigation.startDate), "dd MMM yyyy")
              : "N/A"}
          </span>
        </div>
        <div>
          <span className="text-text-muted block text-[10px] uppercase font-semibold">Total Evidence Records:</span>
          <span className="font-semibold text-foreground font-mono">{data.evidenceSummary.total}</span>
        </div>
      </div>

      {/* Executive Summary */}
      <section className="space-y-2">
        <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border pb-1">
          Executive Summary
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed bg-background p-4 rounded border border-border">
          {data.executiveSummary}
        </p>
      </section>

      {/* Verification Breakdown */}
      <section className="space-y-3">
        <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border pb-1">
          Verification Status Summary
        </h3>
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          <div className="p-3 bg-status-verified/10 rounded border border-status-verified/30">
            <span className="font-serif text-xl font-bold text-status-verified block">
              {data.verificationStats.verified}
            </span>
            <span className="text-[10px] text-text-muted uppercase">Verified</span>
          </div>
          <div className="p-3 bg-status-review/10 rounded border border-status-review/30">
            <span className="font-serif text-xl font-bold text-status-review block">
              {data.verificationStats.underReview}
            </span>
            <span className="text-[10px] text-text-muted uppercase">Under Review</span>
          </div>
          <div className="p-3 bg-accent/10 rounded border border-accent/30">
            <span className="font-serif text-xl font-bold text-accent block">
              {data.verificationStats.aiSuggested}
            </span>
            <span className="text-[10px] text-text-muted uppercase">AI Suggested</span>
          </div>
          <div className="p-3 bg-status-rejected/10 rounded border border-status-rejected/30">
            <span className="font-serif text-xl font-bold text-status-rejected block">
              {data.verificationStats.rejected}
            </span>
            <span className="text-[10px] text-text-muted uppercase">Rejected</span>
          </div>
        </div>
      </section>

      {/* Key Findings */}
      <section className="space-y-3">
        <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border pb-1">
          Key Analytical Findings
        </h3>
        <div className="space-y-2">
          {data.keyFindings.map((f) => (
            <div key={f.id} className="p-4 bg-background rounded border border-border text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">{f.finding}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border uppercase">
                  {f.isInferred ? "AI-Assisted Inference" : "Verified Finding"}
                </span>
              </div>
              <p className="text-text-secondary">{f.whyItMatters}</p>
            </div>
          ))}
          {data.keyFindings.length === 0 && (
            <p className="text-xs text-text-muted">No key findings logged for this investigation.</p>
          )}
        </div>
      </section>

      {/* Active Leads */}
      <section className="space-y-3">
        <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border pb-1">
          Active Investigation Leads ({data.leads.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.leads.map((l) => (
            <div key={l.id} className="p-3 bg-background rounded border border-border text-xs space-y-1">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-foreground">{l.title}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border">
                  {l.category}
                </span>
              </div>
              <p className="text-[10px] text-text-muted">
                Status: {l.status} · Supported by {l.evidenceCount} evidence items
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Significant Relationships */}
      <section className="space-y-3">
        <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border pb-1">
          Significant Relationships ({data.relationships.length})
        </h3>
        <div className="space-y-1.5">
          {data.relationships.map((r) => (
            <div key={r.id} className="p-2.5 bg-background rounded border border-border text-xs flex justify-between items-center">
              <span className="font-medium text-foreground">
                {r.source} → {r.target} <span className="text-text-muted font-mono text-[10px]">({r.type})</span>
              </span>
              <span className="text-[10px] font-mono capitalize text-text-muted px-2 py-0.5 border border-border rounded">
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Notice */}
      <div className="pt-6 border-t border-border text-center text-[10px] text-text-muted font-mono">
        ARGUS Automated Investigation Brief · Confidential · For Official Use Only
      </div>
    </div>
  );
}
