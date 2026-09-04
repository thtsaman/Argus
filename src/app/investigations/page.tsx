import { db } from "@/lib/db";
import { InvestigationsClient } from "@/components/investigation/InvestigationsClient";

export default async function InvestigationsPage() {
  const rawInvestigations = await db.investigation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      lead: { select: { name: true } },
      _count: {
        select: {
          entities: true,
          relationships: true,
          evidence: true,
        },
      },
    },
  });

  const investigations = rawInvestigations.map((inv) => ({
    id: inv.id,
    title: inv.title,
    description: inv.description,
    status: inv.status,
    caseNumber: inv.caseNumber,
    startDate: inv.startDate ? inv.startDate.toISOString() : null,
    endDate: inv.endDate ? inv.endDate.toISOString() : null,
    lead: inv.lead ? { name: inv.lead.name } : null,
    _count: inv._count,
  }));

  return <InvestigationsClient initialInvestigations={investigations} />;
}
