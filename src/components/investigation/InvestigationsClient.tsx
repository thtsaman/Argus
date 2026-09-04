"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, EmptyState } from "@/components/ui/common";
import { InvestigationCard } from "@/components/investigation/InvestigationCard";
import { InvestigationModal, type InvestigationData } from "@/components/investigation/InvestigationModal";
import { ConfirmationModal } from "@/components/investigation/ConfirmationModal";
import { DuplicateModal } from "@/components/investigation/DuplicateModal";

interface InvestigationsClientProps {
  initialInvestigations: InvestigationData[];
}

export function InvestigationsClient({ initialInvestigations }: InvestigationsClientProps) {
  const router = useRouter();
  const [investigations, setInvestigations] = useState<InvestigationData[]>(initialInvestigations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<InvestigationData | null>(null);

  const [duplicateTarget, setDuplicateTarget] = useState<InvestigationData | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<InvestigationData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvestigationData | null>(null);

  const handleOpenCreate = () => {
    setEditingInv(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (inv: InvestigationData) => {
    setEditingInv(inv);
    setIsModalOpen(true);
  };

  const handleSaved = (inv: InvestigationData) => {
    setIsModalOpen(false);
    if (editingInv) {
      // Update local list
      setInvestigations((prev) => prev.map((item) => (item.id === inv.id ? { ...item, ...inv } : item)));
    } else {
      // Created new investigation -> redirect to Evidence Intake page
      router.push(`/investigations/${inv.id}/intake`);
    }
  };

  const handleDuplicateConfirm = async (title: string, description: string) => {
    if (!duplicateTarget) return;

    const res = await fetch(`/api/investigations/${duplicateTarget.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to duplicate investigation");
    }

    setDuplicateTarget(null);
    // Redirect to the newly created duplicated investigation's Evidence Intake page
    router.push(`/investigations/${data.id}/intake`);
  };

  const handleArchiveToggleConfirm = async () => {
    if (!archiveTarget) return;
    const newStatus = archiveTarget.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";

    const res = await fetch(`/api/investigations/${archiveTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update investigation status");
    }

    const updated = await res.json();
    setInvestigations((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item))
    );
    setArchiveTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    const res = await fetch(`/api/investigations/${deleteTarget.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete investigation");
    }

    setInvestigations((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // Filtered investigations
  const filtered = investigations.filter((inv) => {
    // Status filter
    if (statusFilter === "ACTIVE" && inv.status === "ARCHIVED") return false;
    if (statusFilter === "ARCHIVED" && inv.status !== "ARCHIVED") return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = inv.title.toLowerCase().includes(q);
      const matchCase = inv.caseNumber.toLowerCase().includes(q);
      const matchDesc = inv.description?.toLowerCase().includes(q) || false;
      return matchTitle || matchCase || matchDesc;
    }

    return true;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6" suppressHydrationWarning>
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border pb-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">Investigations</h1>
          <p className="text-xs text-text-muted mt-1">
            Create, manage, and investigate evidence-driven cases.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-accent text-surface-elevated text-xs font-semibold rounded hover:bg-accent-hover transition-colors shadow-2xs"
        >
          + Create Investigation
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-background p-3 rounded-md border border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by investigation name or case ID..."
            className="w-full text-xs p-2 bg-surface border border-border rounded text-foreground focus:outline-hidden focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-muted mr-1 font-medium">Status:</span>
          {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded border capitalize transition-colors ${
                statusFilter === st
                  ? "bg-surface border-border-strong text-foreground font-semibold"
                  : "border-border text-text-secondary hover:text-foreground hover:bg-surface"
              }`}
            >
              {st.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Investigation List / Empty State */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No investigations yet"
          description={
            search || statusFilter !== "ALL"
              ? "No investigations match your search or filter criteria."
              : "Create an investigation to begin reviewing evidence and discovering connections."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <InvestigationCard
              key={inv.id}
              investigation={inv}
              onEdit={handleOpenEdit}
              onDuplicate={(target) => setDuplicateTarget(target)}
              onArchiveToggle={(target) => setArchiveTarget(target)}
              onDeleteRequest={(target) => setDeleteTarget(target)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <InvestigationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        editingInvestigation={editingInv}
      />

      {/* Duplicate Modal */}
      {duplicateTarget && (
        <DuplicateModal
          isOpen={!!duplicateTarget}
          originalTitle={duplicateTarget.title}
          originalDescription={duplicateTarget.description}
          onConfirm={handleDuplicateConfirm}
          onClose={() => setDuplicateTarget(null)}
        />
      )}

      {/* Archive / Restore Confirmation */}
      {archiveTarget && (
        <ConfirmationModal
          isOpen={!!archiveTarget}
          title={
            archiveTarget.status === "ARCHIVED" ? "Restore Investigation?" : "Archive Investigation?"
          }
          description={
            archiveTarget.status === "ARCHIVED"
              ? `Restore "${archiveTarget.title}" to active status?`
              : `Are you sure you want to archive "${archiveTarget.title}"? Its evidence and investigation data will remain intact.`
          }
          confirmLabel={
            archiveTarget.status === "ARCHIVED" ? "Restore Investigation" : "Archive Investigation"
          }
          onConfirm={handleArchiveToggleConfirm}
          onClose={() => setArchiveTarget(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmationModal
          isOpen={!!deleteTarget}
          title="Delete Investigation?"
          description={`Are you sure you want to permanently delete "${deleteTarget.title}"? This action cannot be undone. All investigation-specific evidence, entities, relationships, events, leads, patterns, conversations, and related data will be deleted.`}
          confirmLabel="Delete Investigation"
          isDestructive={true}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
