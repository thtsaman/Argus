"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { InvestigationContextBanner } from "@/components/investigation/InvestigationContextBanner";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  occurredAt: string;
  entity: { id?: string; label: string; type: string } | null;
  location: { name: string } | null;
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const entityParam = searchParams.get("entityId");
  const entityLabelParam = searchParams.get("entityLabel");
  const leadTitleParam = searchParams.get("leadTitle");
  const leadEntitiesParam = searchParams.get("entities");

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Evidence modal state
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<boolean>(false);
  const [modalRelationship, setModalRelationship] = useState<{
    source: { label: string };
    target: { label: string };
    type: string;
    evidence: { evidence: { id: string; title: string; type: string; source: string | null; uploadedAt: string | null; rawContent: string | null }; excerpt: string | null }[];
  } | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let url = `/api/investigations/${id}/events`;
    if (entityParam) {
      url += `?entityIds=${entityParam}`;
    } else if (leadEntitiesParam) {
      url += `?entityIds=${leadEntitiesParam}`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      console.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [id, entityParam, leadEntitiesParam]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleShowInNetwork = (event: TimelineEvent) => {
    const targetEntity = event.entity?.id || "";
    router.push(`/investigations/${id}/evidence-space?source=${targetEntity}`);
  };

  const handleViewEvidence = (event: TimelineEvent) => {
    setModalRelationship({
      source: { label: event.entity?.label || event.title },
      target: { label: event.location?.name || "Investigation Event" },
      type: "EVENT_RECORD",
      evidence: [
        {
          evidence: {
            id: event.id,
            title: `Event Log: ${event.title}`,
            type: "EVENT_EVIDENCE",
            source: "Field Investigation Log",
            uploadedAt: event.occurredAt,
            rawContent: event.description || "Official event entry recorded in timeline.",
          },
          excerpt: event.description,
        },
      ],
    });
    setActiveEvidenceModal(true);
  };

  const handleClearContext = () => {
    router.push(`/investigations/${id}/timeline`);
  };

  const filteredEvents = events.filter((e) => {
    const matchesText =
      !filterText ||
      e.title.toLowerCase().includes(filterText.toLowerCase()) ||
      e.entity?.label.toLowerCase().includes(filterText.toLowerCase()) ||
      e.location?.name.toLowerCase().includes(filterText.toLowerCase());

    const matchesType = typeFilter === "ALL" || (e.entity && e.entity.type === typeFilter);

    return matchesText && matchesType;
  });

  if (loading)
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Timeline Analysis"
        description="Temporal sequence of investigation events. Answers: What happened, and when?"
      />

      {/* Context Banner */}
      <InvestigationContextBanner
        investigationId={id}
        leadTitle={leadTitleParam}
        entityName={entityLabelParam}
        onClearContext={handleClearContext}
      />

      {/* Filter Toolbar */}
      <div className="surface-elevated p-4 rounded-lg border border-border flex flex-col md:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Filter events by keyword, entity, or location..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full md:w-80 text-xs border border-border rounded px-3 py-2 bg-background focus:border-accent"
        />

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          <span className="text-[11px] text-text-muted font-medium mr-1">Type:</span>
          {["ALL", "PERSON", "ORGANIZATION", "LOCATION", "VEHICLE"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                typeFilter === t
                  ? "bg-accent text-surface-elevated font-semibold border-accent"
                  : "border-border text-text-secondary hover:text-foreground bg-background"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`surface-elevated rounded-lg border border-border transition-all overflow-hidden ${
                selectedEvent === event.id ? "border-accent/60 shadow-xs" : ""
              }`}
            >
              <div
                onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
                className="p-4 cursor-pointer relative pl-10 flex justify-between items-start gap-4 hover:bg-surface/50 transition-colors"
              >
                <div className="absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 border-accent bg-surface-elevated" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{event.title}</h4>
                    {event.entity && (
                      <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded bg-background">
                        {event.entity.type}
                      </span>
                    )}
                  </div>
                  {event.entity && (
                    <p className="text-xs text-text-secondary mt-1">
                      Entity involved: <span className="font-medium">{event.entity.label}</span>
                    </p>
                  )}
                  {event.location && (
                    <p className="text-xs text-text-muted mt-0.5">
                      Location: <span className="font-medium">{event.location.name}</span>
                    </p>
                  )}
                </div>
                <time className="text-xs text-text-muted font-mono shrink-0">
                  {format(new Date(event.occurredAt), "dd MMM yyyy HH:mm")}
                </time>
              </div>

              {selectedEvent === event.id && (
                <div className="px-10 pb-4 pt-2 border-t border-border/60 bg-background/50 space-y-3">
                  {event.description && (
                    <p className="text-xs text-text-secondary leading-relaxed">{event.description}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleShowInNetwork(event)}
                      className="text-xs py-1.5 px-3 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors"
                    >
                      Show in Network
                    </button>
                    <button
                      onClick={() => handleViewEvidence(event)}
                      className="text-xs py-1.5 px-3 border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground rounded font-medium transition-colors"
                    >
                      View Evidence
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 && (
        <div className="surface p-8 rounded-lg border border-border text-center">
          <p className="text-xs text-text-muted">No timeline events match the current context or filters.</p>
        </div>
      )}

      {/* Evidence Modal */}
      {activeEvidenceModal && modalRelationship && (
        <EvidenceViewModal
          relationship={modalRelationship as any}
          onClose={() => setActiveEvidenceModal(false)}
        />
      )}
    </div>
  );
}
