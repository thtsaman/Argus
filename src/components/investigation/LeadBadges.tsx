"use client";

import type { LeadPriority, LeadStatus, LeadType } from "@/lib/investigation/leads";

export function LeadPriorityBadge({ priority }: { priority: LeadPriority }) {
  const styles: Record<LeadPriority, string> = {
    HIGH: "bg-red-950/20 text-red-700 border-red-800/30 dark:text-red-400 font-semibold",
    MEDIUM: "bg-amber-950/20 text-amber-700 border-amber-800/30 dark:text-amber-400 font-medium",
    LOW: "bg-stone-900/10 text-stone-700 border-stone-400/30 dark:text-stone-400 font-normal",
  };

  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${styles[priority]}`}
    >
      {priority} Priority
    </span>
  );
}

export function LeadTypeBadge({ type }: { type: LeadType }) {
  const labels: Record<LeadType, string> = {
    POTENTIAL_BRIDGE: "Potential Bridge",
    UNVERIFIED_RELATIONSHIP: "Unverified Relationship",
    EVIDENCE_CONFLICT: "Possible Inconsistency",
    CROSS_CASE_CONNECTION: "Cross-Case Connection",
    EVIDENCE_GAP: "Evidence Gap",
  };

  return (
    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
      {labels[type] || type}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const styles: Record<LeadStatus, string> = {
    NEW: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    INVESTIGATING: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    RESOLVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    DISMISSED: "bg-stone-500/10 text-stone-500 border-stone-500/30",
  };

  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border capitalize ${styles[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}
