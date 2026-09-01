"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { InvestigationContextBanner } from "@/components/investigation/InvestigationContextBanner";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";
import { format } from "date-fns";

const MapView = dynamic(() => import("@/components/map/InvestigationMap"), { ssr: false });

interface LocationData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string | null;
  events: { id: string; title: string; occurredAt: string; entityId?: string; entityLabel?: string }[];
}

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const entityParam = searchParams.get("entityId");
  const entityLabelParam = searchParams.get("entityLabel");
  const leadTitleParam = searchParams.get("leadTitle");
  const leadLocationsParam = searchParams.get("locations");

  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);

  // Evidence modal state
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<boolean>(false);
  const [modalRelationship, setModalRelationship] = useState<{
    source: { label: string };
    target: { label: string };
    type: string;
    evidence: { evidence: { id: string; title: string; type: string; source: string | null; uploadedAt: string | null; rawContent: string | null }; excerpt: string | null }[];
  } | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/investigations/${id}/locations`);
      const data = await res.json();
      let locs: LocationData[] = data.locations || [];

      if (leadLocationsParam) {
        const allowed = leadLocationsParam.toLowerCase().split(",");
        locs = locs.filter((l) => allowed.some((a) => l.name.toLowerCase().includes(a)));
      } else if (entityLabelParam) {
        // filter locations associated with entity events if matching
        locs = locs.filter((l) =>
          l.events.some((ev) => ev.entityLabel?.toLowerCase().includes(entityLabelParam.toLowerCase()))
        );
      }

      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0]);
    } catch {
      console.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, [id, leadLocationsParam, entityLabelParam]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleShowInNetwork = (loc: LocationData) => {
    router.push(`/investigations/${id}/evidence-space?search=${encodeURIComponent(loc.name)}`);
  };

  const handleViewEvidence = (loc: LocationData) => {
    setModalRelationship({
      source: { label: loc.name },
      target: { label: loc.region || "Geographic Location" },
      type: "GEOGRAPHIC_OBSERVATION",
      evidence: [
        {
          evidence: {
            id: loc.id,
            title: `Geographic Log: ${loc.name}`,
            type: "LOCATION_RECORD",
            source: "Field Mapping Intelligence",
            uploadedAt: new Date().toISOString(),
            rawContent: `Related activity observed across location: ${loc.name} (${loc.latitude}, ${loc.longitude}).`,
          },
          excerpt: `Location coordinates: ${loc.latitude}, ${loc.longitude}. ${loc.events.length} event(s) recorded at this site.`,
        },
      ],
    });
    setActiveEvidenceModal(true);
  };

  const handleClearContext = () => {
    router.push(`/investigations/${id}/map`);
  };

  if (loading)
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Geographic Analysis"
        description="Location-based view of investigation events. Answers: Where did the relevant activity happen?"
      />

      {/* Context Banner */}
      <InvestigationContextBanner
        investigationId={id}
        leadTitle={leadTitleParam}
        entityName={entityLabelParam}
        onClearContext={handleClearContext}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map view */}
        <div className="lg:col-span-2 surface rounded-lg border border-border h-[600px] overflow-hidden shadow-2xs">
          <MapView locations={locations} />
        </div>

        {/* Location Intelligence Panel */}
        <div className="surface-elevated p-5 rounded-lg border border-border space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="font-serif text-lg font-semibold text-foreground border-b border-border pb-2">
              Geographic Intelligence
            </h3>

            {selectedLocation ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-base text-foreground">{selectedLocation.name}</h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    Coordinates: {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                  </p>
                  {selectedLocation.region && (
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 border border-border rounded bg-background inline-block mt-1">
                      Region: {selectedLocation.region}
                    </span>
                  )}
                </div>

                <div className="p-3 bg-background rounded border border-border text-xs text-text-secondary">
                  <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mb-1">
                    Observed Activity:
                  </span>
                  Related activity observed across this location in {selectedLocation.events.length} event record(s).
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">
                    Recorded Events at Site ({selectedLocation.events.length})
                  </span>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                    {selectedLocation.events.map((ev) => (
                      <div key={ev.id} className="p-2 bg-background rounded border border-border/70 text-xs">
                        <p className="font-medium text-foreground">{ev.title}</p>
                        <time className="text-[10px] text-text-muted font-mono">
                          {format(new Date(ev.occurredAt), "dd MMM yyyy HH:mm")}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Select a map marker to view location context.</p>
            )}
          </div>

          {selectedLocation && (
            <div className="pt-4 border-t border-border flex gap-2">
              <button
                onClick={() => handleShowInNetwork(selectedLocation)}
                className="flex-1 text-xs py-2 px-3 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors text-center"
              >
                Show in Network
              </button>
              <button
                onClick={() => handleViewEvidence(selectedLocation)}
                className="flex-1 text-xs py-2 px-3 border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground rounded font-medium transition-colors text-center"
              >
                View Evidence
              </button>
            </div>
          )}
        </div>
      </div>

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
