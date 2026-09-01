import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { PageHeader, SectionHeader } from "@/components/ui/common";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import { generateInvestigationLeads } from "@/lib/investigation/leads";
import { LeadsOverviewSection } from "@/components/investigation/LeadsOverviewSection";

export default async function InvestigationOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const investigation = await db.investigation.findUnique({
    where: { id },
    include: {
      lead: { select: { name: true, role: true } },
      entities: { take: 8, orderBy: { createdAt: "desc" } },
      evidence: {
        where: { status: { in: ["EXTRACTED", "PENDING"] } },
        take: 5,
        orderBy: { uploadedAt: "desc" },
      },
      relationships: {
        where: { status: "UNDER_REVIEW" },
        take: 5,
        include: {
          source: { select: { label: true } },
          target: { select: { label: true } },
        },
      },
      events: { orderBy: { occurredAt: "desc" }, take: 5 },
      candidates: { where: { status: "PENDING" }, take: 5 },
      _count: {
        select: {
          entities: true,
          relationships: true,
          evidence: true,
          events: true,
          locations: true,
          candidates: true,
        },
      },
    },
  });

  if (!investigation) notFound();

  const leads = await generateInvestigationLeads(id);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title={investigation.title}
        description={investigation.description || undefined}
        actions={
          <span className="text-xs font-medium px-2 py-1 rounded border border-border text-text-secondary">
            {investigation.status}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="surface-elevated p-5">
          <SectionHeader title="Investigation scope" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Case number</dt>
              <dd className="font-medium">{investigation.caseNumber}</dd>
            </div>
            {investigation.startDate && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Time range</dt>
                <dd>
                  {format(investigation.startDate, "dd MMM yyyy")}
                  {investigation.endDate && ` — ${format(investigation.endDate, "dd MMM yyyy")}`}
                </dd>
              </div>
            )}
            {investigation.lead && (
              <div className="flex justify-between">
                <dt className="text-text-muted">Lead investigator</dt>
                <dd>{investigation.lead.name}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="surface-elevated p-5">
          <SectionHeader title="Evidence summary" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Total evidence</dt>
              <dd className="font-medium">{investigation._count.evidence}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Pending review</dt>
              <dd className="font-medium text-status-review">{investigation._count.candidates}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Locations tracked</dt>
              <dd>{investigation._count.locations}</dd>
            </div>
          </dl>
        </div>

        <div className="surface-elevated p-5">
          <SectionHeader title="Network summary" />
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Entities</dt>
              <dd className="font-medium">{investigation._count.entities}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Relationships</dt>
              <dd className="font-medium">{investigation._count.relationships}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Events</dt>
              <dd>{investigation._count.events}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Investigation Leads Section */}
      <LeadsOverviewSection leads={leads} investigationId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Analysis entry points" subtitle="Begin exploring the investigation" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: `/investigations/${id}/evidence-space`, label: "Evidence Space", desc: "Entity relationship graph" },
              { href: `/investigations/${id}/bridge`, label: "Bridge View", desc: "Connection storytelling" },
              { href: `/investigations/${id}/timeline`, label: "Timeline", desc: "Temporal patterns" },
              { href: `/investigations/${id}/map`, label: "Geographic", desc: "Location analysis" },
              { href: `/investigations/${id}/replay`, label: "Replay", desc: "Investigation evolution" },
              { href: `/investigations/${id}/assistant`, label: "Assistant", desc: "Evidence-grounded AI" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="surface p-4 hover:border-border-strong transition-colors"
              >
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-text-muted mt-1">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {investigation.candidates.length > 0 && (
            <div>
              <SectionHeader title="Findings requiring review" />
              <div className="space-y-2">
                {investigation.candidates.map((c) => (
                  <Link
                    key={c.id}
                    href={`/investigations/${id}/review`}
                    className="block surface p-3 hover:border-border-strong transition-colors"
                  >
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{c.type} — pending verification</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {investigation.relationships.length > 0 && (
            <div>
              <SectionHeader title="Relationships under review" />
              <div className="space-y-2">
                {investigation.relationships.map((r) => (
                  <div key={r.id} className="surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">
                        {r.source.label} → {r.target.label}
                      </p>
                      <RelationshipStatusBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionHeader title="Recent events" />
            <div className="space-y-2">
              {investigation.events.map((e) => (
                <div key={e.id} className="surface p-3">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">{e.title}</p>
                    <time className="text-xs text-text-muted shrink-0">
                      {format(e.occurredAt, "dd MMM yyyy")}
                    </time>
                  </div>
                  {e.description && <p className="text-xs text-text-muted mt-1">{e.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
