import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/common";
import { format } from "date-fns";

export default async function InvestigationsPage() {
  const investigations = await db.investigation.findMany({
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

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8" suppressHydrationWarning>
      <PageHeader
        title="Investigations"
        description="Select an investigation to explore evidence, relationships, and analysis."
      />

      {investigations.length === 0 ? (
        <EmptyState
          title="No investigations found"
          description="Run npm run db:seed to generate demo data."
        />
      ) : (
        <div className="space-y-3">
          {investigations.map((inv) => (
            <Link
              key={inv.id}
              href={`/investigations/${inv.id}`}
              className="block surface-elevated p-5 hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-medium">{inv.title}</h2>
                  <p className="text-sm text-text-muted mt-1">{inv.caseNumber}</p>
                  {inv.description && (
                    <p className="text-sm text-text-secondary mt-2 line-clamp-2">{inv.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-medium px-2 py-0.5 rounded border border-border text-text-secondary">
                    {inv.status}
                  </span>
                  {inv.startDate && (
                    <p className="text-xs text-text-muted mt-2">
                      {format(inv.startDate, "MMM yyyy")}
                      {inv.endDate && ` — ${format(inv.endDate, "MMM yyyy")}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-6 mt-4 text-xs text-text-muted">
                <span>{inv._count.entities} entities</span>
                <span>{inv._count.relationships} relationships</span>
                <span>{inv._count.evidence} evidence items</span>
                {inv.lead && <span>Lead: {inv.lead.name}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
