"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { InvestigationContextBanner } from "@/components/investigation/InvestigationContextBanner";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";
import type { GraphData } from "@/lib/graph/analysis";

interface ReplayFrame {
  timestamp: string;
  events: { id: string; title: string; entityId?: string }[];
  relationships: { id: string; sourceId: string; targetId: string; status: string; type?: string }[];
  entities: { id: string; label: string; type: string }[];
}

export default function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const leadTitleParam = searchParams.get("leadTitle");

  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Active inspectors
  const [selectedRelForInspection, setSelectedRelForInspection] = useState<{
    id: string;
    source: string;
    target: string;
    status: string;
  } | null>(null);

  // Evidence Modal
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<boolean>(false);
  const [modalRelationship, setModalRelationship] = useState<{
    source: { label: string };
    target: { label: string };
    type: string;
    evidence: { evidence: { id: string; title: string; type: string; source: string | null; uploadedAt: string | null; rawContent: string | null }; excerpt: string | null }[];
  } | null>(null);

  useEffect(() => {
    fetch(`/api/investigations/${id}/replay`)
      .then((r) => r.json())
      .then((data) => {
        setFrames(data.frames || []);
        setLoading(false);
      });
  }, [id]);

  const play = useCallback(() => {
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= frames.length - 1) {
          setPlaying(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
  }, [frames.length]);

  const pause = () => {
    setPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const handleClearContext = () => {
    router.push(`/investigations/${id}/replay`);
  };

  const handleInspectRelationship = (rel: { id: string; source: string; target: string; status: string }) => {
    pause();
    setSelectedRelForInspection(rel);
  };

  const handleViewEvidenceForRel = (rel: { id: string; source: string; target: string; status: string }) => {
    setModalRelationship({
      source: { label: rel.source },
      target: { label: rel.target },
      type: "REPLAY_RELATIONSHIP",
      evidence: [
        {
          evidence: {
            id: rel.id,
            title: `Replay Link: ${rel.source} → ${rel.target}`,
            type: "RELATIONSHIP_RECORD",
            source: "Investigation Replay Sequence",
            uploadedAt: frames[currentFrame]?.timestamp || new Date().toISOString(),
            rawContent: `Relationship status at this frame: ${rel.status}`,
          },
          excerpt: `Relationship between ${rel.source} and ${rel.target} emerged during timestamp ${format(
            new Date(frames[currentFrame]?.timestamp || Date.now()),
            "dd MMM yyyy"
          )}.`,
        },
      ],
    });
    setActiveEvidenceModal(true);
  };

  const handleViewTimeline = () => {
    router.push(`/investigations/${id}/timeline`);
  };

  if (loading)
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );
  if (frames.length === 0)
    return (
      <div className="p-8">
        <p className="text-xs text-text-muted">No replay data available.</p>
      </div>
    );

  const frame = frames[currentFrame];
  const cumulativeEntities = new Map<string, { id: string; label: string; type: string }>();
  const cumulativeRels: { id: string; source: string; target: string; status: string; sourceLabel?: string; targetLabel?: string }[] = [];
  const seenRels = new Set<string>();

  for (let i = 0; i <= currentFrame; i++) {
    frames[i].entities.forEach((e) => cumulativeEntities.set(e.id, e));
    frames[i].relationships.forEach((r) => {
      if (!seenRels.has(r.id)) {
        seenRels.add(r.id);
        const sourceLabel = cumulativeEntities.get(r.sourceId)?.label || r.sourceId;
        const targetLabel = cumulativeEntities.get(r.targetId)?.label || r.targetId;
        cumulativeRels.push({
          id: r.id,
          source: r.sourceId,
          target: r.targetId,
          sourceLabel,
          targetLabel,
          status: r.status,
        });
      }
    });
  }

  const nodeIds = new Set(cumulativeEntities.keys());

  const graphData: GraphData = {
    nodes: [...cumulativeEntities.values()].map((e) => ({
      id: e.id,
      label: e.label,
      type: e.type,
    })),
    links: cumulativeRels
      .filter((r) => nodeIds.has(r.source) && nodeIds.has(r.target))
      .map((r) => ({
        id: r.id,
        source: r.source,
        target: r.target,
        type: "ASSOCIATED_WITH",
        status: r.status as GraphData["links"][0]["status"],
      })),
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Investigation Replay"
        description="Watch how the investigation network developed over time — entities, events, and relationships emerging chronologically."
      />

      {/* Context Banner */}
      <InvestigationContextBanner
        investigationId={id}
        leadTitle={leadTitleParam}
        onClearContext={handleClearContext}
      />

      {/* Overview Context Panel */}
      <div className="surface-elevated p-4 rounded-lg border border-border flex items-center justify-between gap-4 text-xs">
        <div>
          <span className="font-semibold text-foreground uppercase tracking-wider block">
            INVESTIGATION REPLAY CONTEXT
          </span>
          <p className="text-text-muted mt-0.5">
            Watch the investigation network develop as events and relationships appear over time.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono shrink-0">
          <div>
            <span className="text-text-muted block">Timestamp:</span>
            <span className="font-semibold text-foreground">
              {format(new Date(frame.timestamp), "dd MMM yyyy")}
            </span>
          </div>
          <div>
            <span className="text-text-muted block">Cumulative Events:</span>
            <span className="font-semibold text-foreground">{frame.events.length}</span>
          </div>
          <div>
            <span className="text-text-muted block">Cumulative Relationships:</span>
            <span className="font-semibold text-foreground">{cumulativeRels.length}</span>
          </div>
        </div>
      </div>

      {/* Replay Controls */}
      <div className="flex items-center gap-3 surface-elevated p-3 rounded-lg border border-border">
        <button
          onClick={playing ? pause : play}
          className="text-xs py-1.5 px-4 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover transition-colors shadow-2xs"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={() => {
            pause();
            setCurrentFrame(0);
          }}
          className="text-xs py-1.5 px-3 border border-border rounded text-text-secondary hover:text-foreground"
        >
          Reset
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentFrame}
          onChange={(e) => {
            pause();
            setCurrentFrame(Number(e.target.value));
          }}
          className="flex-1 accent-accent"
        />
        <span className="text-xs text-text-muted font-mono shrink-0">
          Frame {currentFrame + 1} of {frames.length}
        </span>
        <button
          onClick={handleViewTimeline}
          className="text-xs py-1.5 px-3 border border-accent/40 bg-accent/5 text-accent rounded font-medium hover:bg-accent/10 transition-colors"
        >
          View Timeline
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Network Replay Graph */}
        <div className="lg:col-span-2 surface rounded-lg border border-border h-[500px] overflow-hidden">
          <EvidenceGraph data={graphData} height={500} />
        </div>

        {/* Replay Frame Inspector */}
        <div className="surface-elevated p-4 rounded-lg border border-border space-y-4">
          <SectionHeader title="Emerging Events & Connections" />

          {/* Newly emerged relationships */}
          {frame.relationships.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">
                Newly Formed Relationships ({frame.relationships.length})
              </span>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {frame.relationships.map((rel) => {
                  const srcLabel = cumulativeEntities.get(rel.sourceId)?.label || rel.sourceId;
                  const tgtLabel = cumulativeEntities.get(rel.targetId)?.label || rel.targetId;
                  return (
                    <div
                      key={rel.id}
                      className="p-2.5 bg-background rounded border border-border text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">
                          {srcLabel} → {tgtLabel}
                        </span>
                        <span className="text-[10px] font-mono capitalize text-text-muted">{rel.status}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleInspectRelationship({
                              id: rel.id,
                              source: srcLabel,
                              target: tgtLabel,
                              status: rel.status,
                            })
                          }
                          className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded font-medium"
                        >
                          Inspect Relationship
                        </button>
                        <button
                          onClick={() =>
                            handleViewEvidenceForRel({
                              id: rel.id,
                              source: srcLabel,
                              target: tgtLabel,
                              status: rel.status,
                            })
                          }
                          className="text-[10px] px-2 py-0.5 border border-border text-text-secondary hover:text-foreground rounded"
                        >
                          View Evidence
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Events at timestamp */}
          <div className="space-y-2">
            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">
              Events at Timestamp ({frame.events.length})
            </span>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
              {frame.events.map((e) => (
                <div key={e.id} className="p-2.5 bg-background rounded border border-border/70 text-xs">
                  <p className="font-medium text-foreground">{e.title}</p>
                </div>
              ))}
              {frame.events.length === 0 && (
                <p className="text-xs text-text-muted p-2 surface rounded">No events at this timestamp.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence View Modal */}
      {activeEvidenceModal && modalRelationship && (
        <EvidenceViewModal
          relationship={modalRelationship as any}
          onClose={() => setActiveEvidenceModal(false)}
        />
      )}
    </div>
  );
}
