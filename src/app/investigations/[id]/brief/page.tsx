"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { InvestigationBriefView, type InvestigationBriefData } from "@/components/investigation/InvestigationBriefView";

export default function BriefPage() {
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<InvestigationBriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/investigations/${id}/brief`)
      .then((r) => r.json())
      .then((data) => {
        setBrief(data);
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );

  if (!brief || (brief as any).error)
    return (
      <div className="p-8 max-w-[1000px] mx-auto">
        <p className="text-xs text-text-muted">Failed to generate investigation brief.</p>
      </div>
    );

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Investigation Brief"
        description="Factual, real-time executive summary of investigation leads, verification metrics, and entity intelligence."
      />
      <InvestigationBriefView data={brief} />
    </div>
  );
}
