"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InvestigationLead } from "@/lib/investigation/leads";
import { LeadCard } from "./LeadCard";
import { LeadDetail } from "./LeadDetail";
import { SectionHeader } from "@/components/ui/common";

interface LeadsOverviewSectionProps {
  leads: InvestigationLead[];
  investigationId: string;
}

export function LeadsOverviewSection({ leads: initialLeads, investigationId }: LeadsOverviewSectionProps) {
  const router = useRouter();
  const [leads, setLeads] = useState<InvestigationLead[]>(initialLeads);
  const [activeLead, setActiveLead] = useState<InvestigationLead | null>(null);

  const activeCount = leads.filter((l) => l.status === "NEW" || l.status === "INVESTIGATING").length;

  const handleStatusChange = (leadId: string, newStatus: InvestigationLead["status"]) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    if (activeLead && activeLead.id === leadId) {
      setActiveLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleFocusGraph = (lead: InvestigationLead) => {
    // Navigate to evidence-space with selected lead target
    const sourceId = lead.sourceEntityId || lead.relatedEntityIds[0] || "";
    const targetId = lead.targetEntityId || lead.relatedEntityIds[1] || "";
    router.push(
      `/investigations/${investigationId}/evidence-space?leadId=${lead.id}&source=${sourceId}&target=${targetId}`
    );
  };

  if (leads.length === 0) {
    return (
      <div className="surface-elevated p-6 rounded-lg border border-border text-center space-y-2 mb-8">
        <h3 className="font-serif text-lg font-semibold text-foreground">
          NO ACTIVE INVESTIGATION LEADS
        </h3>
        <p className="text-xs text-text-muted max-w-lg mx-auto">
          ARGUS has not identified any unresolved analytical findings requiring attention at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-elevated p-6 rounded-lg border border-border space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Investigation Leads"
          subtitle={`${activeCount} analytical item(s) require investigator attention`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.slice(0, 6).map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onInvestigate={(selected) => setActiveLead(selected)}
          />
        ))}
      </div>

      {activeLead && (
        <div className="pt-4 border-t border-border">
          <LeadDetail
            lead={activeLead}
            investigationId={investigationId}
            onClose={() => setActiveLead(null)}
            onStatusChange={handleStatusChange}
            onFocusGraph={handleFocusGraph}
          />
        </div>
      )}
    </div>
  );
}
