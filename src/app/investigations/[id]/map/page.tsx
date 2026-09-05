"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { ContextualChatWidget } from "@/components/investigation/ContextualChatWidget";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";
import { GeoLocation } from "@/components/map/GeospatialMap";
import { format } from "date-fns";

const GeospatialMap = dynamic(() => import("@/components/map/GeospatialMap"), { ssr: false });

export default function GeospatialMapPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const entityParam = searchParams.get("entityId");
  const entityLabelParam = searchParams.get("entityLabel");

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<GeoLocation[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);

  // Selected State
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);

  // Map Modes & Controls
  const [activeIncident, setActiveIncident] = useState<string>("ALL");
  const [mapStyle, setMapStyle] = useState<"STANDARD" | "SATELLITE" | "TERRAIN">("STANDARD");
  const [is3D, setIs3D] = useState<boolean>(true);
  const [showDensity, setShowDensity] = useState<boolean>(false);

  // Timeline & Replay Engine State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState<number>(0);

  // Assistant Widget State
  const [showAssistant, setShowAssistant] = useState<boolean>(false);

  // Evidence Modal State
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<boolean>(false);
  const [modalRelationship, setModalRelationship] = useState<any | null>(null);

  // Fetch full geospatial database records
  const fetchGeospatialData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/investigations/${id}/locations`);
      const data = await res.json();

      let locs: GeoLocation[] = data.locations || [];
      let evts: any[] = data.events || [];

      // Scoped entity filter if navigating from Key Network
      if (entityLabelParam) {
        locs = locs.filter((l) =>
          l.events.some((e) => e.entity?.label?.toLowerCase().includes(entityLabelParam.toLowerCase()))
        );
      }

      setLocations(locs);
      setEvents(evts);
      setEntities(data.entities || []);
      setEvidence(data.evidence || []);

      if (locs.length > 0) {
        setSelectedLocation(locs[0]);
      }
    } catch {
      console.error("Failed to load geospatial investigation dataset");
    } finally {
      setLoading(false);
    }
  }, [id, entityLabelParam]);

  useEffect(() => {
    fetchGeospatialData();
  }, [fetchGeospatialData]);

  // Timeline events filtered by active incident window
  const filteredEvents = useMemo(() => {
    if (activeIncident === "ALL") return events;
    return events.filter((e) => e.incident === activeIncident);
  }, [events, activeIncident]);

  // Play / Pause Replay Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && filteredEvents.length > 0) {
      interval = setInterval(() => {
        setCurrentTimeIndex((prev) => {
          if (prev >= filteredEvents.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2400);
    }
    return () => clearInterval(interval);
  }, [isPlaying, filteredEvents]);

  // Derive "Why This Location Matters" dynamically from trusted data
  const whyItMatters = useMemo(() => {
    if (!selectedLocation) return "";

    const siteEvents = selectedLocation.events || [];
    const eventCount = siteEvents.length;
    const incidents = selectedLocation.incidents || [];
    const associatedEntities = Array.from(
      new Set(siteEvents.map((e) => e.entity?.label).filter(Boolean))
    );

    if (incidents.length > 1) {
      return `CRITICAL CROSS-INCIDENT OVERLAP: Location activity is shared across ${incidents.join(
        " and "
      )}. ${eventCount} recorded events associated with ${associatedEntities.join(", ")}.`;
    }

    if (associatedEntities.length > 0) {
      return `Logistics & observation hub for ${associatedEntities.join(
        ", "
      )} during ${incidents.join(", ") || "the investigation window"}.`;
    }

    return `Geographic point of interest with ${eventCount} documented event log(s).`;
  }, [selectedLocation]);

  // Navigation handlers
  const handleShowInNetwork = (loc: GeoLocation) => {
    router.push(`/investigations/${id}/evidence-space?search=${encodeURIComponent(loc.name)}`);
  };

  const handleViewEvidence = (loc: GeoLocation) => {
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
            rawContent: `Observed activity at ${loc.name} (${loc.latitude}, ${loc.longitude}). ${loc.events.length} event(s) recorded at this site.`,
          },
          excerpt: `Location coordinates: ${loc.latitude}, ${loc.longitude}. Address: ${loc.address || "N/A"}.`,
        },
      ],
    });
    setActiveEvidenceModal(true);
  };

  const handleCreateTask = async () => {
    if (!selectedLocation) return;
    try {
      await fetch(`/api/investigations/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Investigate Site Activity: ${selectedLocation.name}`,
          description: `Verify operational logs, visitor registers, and entity presence at ${selectedLocation.name}.`,
          whyItMatters,
          priority: selectedLocation.incidents.length > 1 ? "HIGH" : "MEDIUM",
          sourceType: "LEAD_DERIVED",
          expectedOutcome: `Establish whether repeated site presence at ${selectedLocation.name} has a verified operational explanation.`,
        }),
      });
      alert(`Investigation Task created for ${selectedLocation.name}!`);
    } catch {
      alert("Failed to create task.");
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <LoadingState message="ARGUS: Reconstructing 3D Geospatial Investigation..." />
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-5">
      {/* Header */}
      <PageHeader
        title="Geospatial Intelligence & Movement Reconstruction"
        description="3D temporal-spatial reconstruction of examination paper logistics, location clustering, cross-incident overlaps, and vehicle movement paths."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedLocation(null);
                if (locations.length > 0) setSelectedLocation(locations[0]);
              }}
              className="px-3 py-1.5 rounded border border-border bg-surface-elevated text-xs font-semibold hover:bg-surface text-foreground shadow-2xs transition-colors"
            >
              Fit Investigation View
            </button>
            <button
              onClick={() => setShowAssistant(true)}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Ask ARGUS
            </button>
          </div>
        }
      />

      {/* Incident Filter Strip */}
      <div className="flex items-center justify-between bg-surface p-2.5 rounded border border-border">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-semibold uppercase text-text-muted mr-2">Incident Window:</span>
          {["ALL", "EX-01", "EX-02", "EX-03", "EX-04"].map((inc) => (
            <button
              key={inc}
              onClick={() => {
                setActiveIncident(inc);
                setCurrentTimeIndex(0);
              }}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded border transition-colors ${
                activeIncident === inc
                  ? "bg-accent text-surface-elevated border-accent shadow-2xs"
                  : "bg-background text-text-secondary border-border hover:bg-surface"
              }`}
            >
              {inc}
            </button>
          ))}
        </div>

        {/* Map View Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => setMapStyle("STANDARD")}
              className={`px-2.5 py-1 text-xs font-medium ${
                mapStyle === "STANDARD" ? "bg-surface-elevated text-foreground font-semibold" : "bg-background text-text-muted"
              }`}
            >
              STANDARD
            </button>
            <button
              onClick={() => setMapStyle("SATELLITE")}
              className={`px-2.5 py-1 text-xs font-medium ${
                mapStyle === "SATELLITE" ? "bg-surface-elevated text-foreground font-semibold" : "bg-background text-text-muted"
              }`}
            >
              SATELLITE
            </button>
          </div>

          <button
            onClick={() => setIs3D(!is3D)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${
              is3D ? "bg-emerald-500/20 text-emerald-700 border-emerald-500" : "bg-background text-text-secondary border-border"
            }`}
          >
            {is3D ? "3D TILT ON" : "2D FLAT"}
          </button>
        </div>
      </div>

      {/* Main Map + Intelligence Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[640px]">
        {/* Main 3D Map Hero Container */}
        <div className="lg:col-span-2 surface rounded-lg border border-border overflow-hidden relative shadow-md">
          <GeospatialMap
            locations={locations}
            selectedLocationId={selectedLocation?.id || null}
            onSelectLocation={(loc) => setSelectedLocation(loc)}
            mapStyle={mapStyle}
            is3D={is3D}
            activeIncident={activeIncident}
            currentTimeIndex={currentTimeIndex}
            timeEvents={filteredEvents}
            showDensity={showDensity}
            isPlaying={isPlaying}
          />

          {/* Map Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-10 bg-[#2c2416]/90 backdrop-blur-md text-[#faf7f2] p-3 rounded border border-[#6b5344] text-[11px] font-mono space-y-1.5 shadow-xl">
            <div className="font-bold text-accent uppercase tracking-wider text-[10px]">Geographic Legend</div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600"></span>
              <span>Incident Location</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-600"></span>
              <span>Active Selected Site</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">🚗</span>
              <span>Vehicle Movement</span>
            </div>
          </div>
        </div>

        {/* Location Intelligence Panel */}
        <div className="surface-elevated p-5 rounded-lg border border-border space-y-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-foreground">Location Intelligence</h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-border text-accent">
                {selectedLocation?.incidents.join(", ") || "SITE INFO"}
              </span>
            </div>

            {selectedLocation ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-lg text-foreground">{selectedLocation.name}</h4>
                  <p className="text-xs text-text-muted font-mono mt-0.5">
                    Lat/Lng: {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                  </p>
                  {selectedLocation.region && (
                    <span className="text-[11px] font-mono px-2 py-0.5 border border-border rounded bg-background inline-block mt-1 text-text-secondary">
                      Region: {selectedLocation.region}
                    </span>
                  )}
                </div>

                {/* Why This Location Matters */}
                <div className="p-3 bg-background rounded border border-border space-y-1">
                  <span className="text-[10px] text-accent font-semibold uppercase tracking-wider block font-mono">
                    Why This Location Matters:
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed font-sans">{whyItMatters}</p>
                </div>

                {/* Events Log at Site */}
                <div className="space-y-2">
                  <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block font-mono">
                    Recorded Events at Site ({selectedLocation.events.length})
                  </span>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedLocation.events.map((ev) => (
                      <div key={ev.id} className="p-2.5 bg-background rounded border border-border/80 space-y-1">
                        <p className="font-medium text-xs text-foreground">{ev.title}</p>
                        <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
                          <span>{format(new Date(ev.occurredAt), "dd MMM yyyy HH:mm")}</span>
                          {ev.entity && <span className="text-accent font-semibold">{ev.entity.label}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Select a map marker to view spatial context.</p>
            )}
          </div>

          {/* Action Buttons */}
          {selectedLocation && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleShowInNetwork(selectedLocation)}
                  className="flex-1 text-xs py-2 px-3 bg-accent text-surface-elevated rounded font-semibold hover:bg-accent-hover transition-colors text-center"
                >
                  Show in Network
                </button>
                <button
                  onClick={() => handleViewEvidence(selectedLocation)}
                  className="flex-1 text-xs py-2 px-3 border border-border bg-background hover:bg-surface text-text-secondary hover:text-foreground rounded font-semibold transition-colors text-center"
                >
                  View Evidence
                </button>
              </div>
              <button
                onClick={handleCreateTask}
                className="w-full text-xs py-2 px-3 border border-emerald-600/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 font-semibold rounded transition-colors text-center"
              >
                + Create Investigation Task
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Timeline Scrubber & Replay Control Bar */}
      <div className="bg-surface p-4 rounded-lg border border-border space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold transition-colors shadow-2xs"
            >
              {isPlaying ? "⏸ PAUSE REPLAY" : "▶ PLAY REPLAY"}
            </button>
            <span className="text-xs font-mono font-semibold text-text-secondary">
              Chronological Reconstruction ({filteredEvents.length} Events)
            </span>
          </div>

          {filteredEvents[currentTimeIndex] && (
            <div className="text-xs font-mono font-bold text-accent">
              Active Date: {format(new Date(filteredEvents[currentTimeIndex].occurredAt), "dd MMM yyyy HH:mm")} · {filteredEvents[currentTimeIndex].title}
            </div>
          )}
        </div>

        {/* Interactive Draggable Range Scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(filteredEvents.length - 1, 0)}
          value={currentTimeIndex}
          onChange={(e) => setCurrentTimeIndex(Number(e.target.value))}
          className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />
      </div>

      {/* Contextual Ask ARGUS Floating Chat Widget */}
      {showAssistant && (
        <ContextualChatWidget
          investigationId={id}
          contextType="GEOGRAPHIC"
          contextId={selectedLocation?.id || id}
          contextLabel={selectedLocation?.name || "Geospatial Analysis"}
          onClose={() => setShowAssistant(false)}
        />
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
