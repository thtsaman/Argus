"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { InvestigationData } from "./InvestigationModal";

interface InvestigationCardProps {
  investigation: InvestigationData;
  onEdit: (inv: InvestigationData) => void;
  onDuplicate: (inv: InvestigationData) => void;
  onArchiveToggle: (inv: InvestigationData) => void;
  onDeleteRequest: (inv: InvestigationData) => void;
}

export function InvestigationCard({
  investigation,
  onEdit,
  onDuplicate,
  onArchiveToggle,
  onDeleteRequest,
}: InvestigationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isArchived = investigation.status === "ARCHIVED";

  return (
    <div className="surface-elevated p-5 border border-border hover:border-border-strong transition-all rounded-md relative shadow-2xs">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/investigations/${investigation.id}`} className="block flex-1 group">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-serif text-lg font-medium text-foreground group-hover:text-accent transition-colors">
              {investigation.title}
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded border border-border bg-background text-text-muted">
              {investigation.caseNumber}
            </span>
          </div>

          {investigation.description && (
            <p className="text-sm text-text-secondary mt-2 line-clamp-2 leading-relaxed">
              {investigation.description}
            </p>
          )}
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border ${
              isArchived
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "border-border text-text-secondary"
            }`}
          >
            {investigation.status}
          </span>

          {/* Action Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 text-text-muted hover:text-foreground hover:bg-surface rounded border border-border/60 transition-colors"
              title="Actions"
            >
              ⋮
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-background border border-border rounded shadow-md z-20 py-1 text-xs space-y-0.5">
                  <Link
                    href={`/investigations/${investigation.id}`}
                    className="block px-3 py-1.5 text-text-secondary hover:text-foreground hover:bg-surface transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open Investigation
                  </Link>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(investigation);
                    }}
                    className="w-full text-left px-3 py-1.5 text-text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  >
                    Edit Metadata
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate(investigation);
                    }}
                    className="w-full text-left px-3 py-1.5 text-text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  >
                    Duplicate
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onArchiveToggle(investigation);
                    }}
                    className="w-full text-left px-3 py-1.5 text-text-secondary hover:text-foreground hover:bg-surface transition-colors"
                  >
                    {isArchived ? "Restore Investigation" : "Archive Investigation"}
                  </button>

                  <div className="border-t border-border/50 my-1" />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteRequest(investigation);
                    }}
                    className="w-full text-left px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors font-medium"
                  >
                    Delete Investigation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-text-muted border-t border-border/50 pt-3">
        <div className="flex gap-4">
          <span>{investigation._count?.entities || 0} entities</span>
          <span>{investigation._count?.relationships || 0} relationships</span>
          <span>{investigation._count?.evidence || 0} evidence items</span>
          {investigation.lead?.name && <span>Lead: {investigation.lead.name}</span>}
        </div>

        {investigation.startDate && (
          <div>
            {format(new Date(investigation.startDate), "MMM yyyy")}
            {investigation.endDate && ` — ${format(new Date(investigation.endDate), "MMM yyyy")}`}
          </div>
        )}
      </div>
    </div>
  );
}
