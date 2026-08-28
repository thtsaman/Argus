"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import type { GraphData } from "@/lib/graph/analysis";

interface ReplayFrame {
  timestamp: string;
  events: { id: string; title: string }[];
  relationships: { id: string; sourceId: string; targetId: string; status: string }[];
  entities: { id: string; label: string; type: string }[];
}

export default function ReplayPage() {
  const { id } = useParams<{ id: string }>();
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  if (loading) return <div className="p-8"><LoadingState /></div>;
  if (frames.length === 0) return <div className="p-8"><p className="text-text-muted">No replay data available.</p></div>;

  const frame = frames[currentFrame];
  const cumulativeEntities = new Map<string, { id: string; label: string; type: string }>();
  const cumulativeRels: { id: string; source: string; target: string; status: string }[] = [];
  const seenRels = new Set<string>();

  for (let i = 0; i <= currentFrame; i++) {
    frames[i].entities.forEach((e) => cumulativeEntities.set(e.id, e));
    frames[i].relationships.forEach((r) => {
      if (!seenRels.has(r.id)) {
        seenRels.add(r.id);
        cumulativeRels.push({ id: r.id, source: r.sourceId, target: r.targetId, status: r.status });
      }
    });
  }

  const graphData: GraphData = {
    nodes: [...cumulativeEntities.values()].map((e) => ({
      id: e.id,
      label: e.label,
      type: e.type,
    })),
    links: cumulativeRels.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: "ASSOCIATED_WITH",
      status: r.status as GraphData["links"][0]["status"],
    })),
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title="Investigation Replay"
        description="Watch how the investigation evolved over time — entities, events, and relationships emerging chronologically."
      />

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={playing ? pause : play}
          className="text-sm px-4 py-1.5 bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentFrame}
          onChange={(e) => { pause(); setCurrentFrame(Number(e.target.value)); }}
          className="flex-1"
        />
        <span className="text-sm text-text-muted shrink-0">
          {format(new Date(frame.timestamp), "dd MMM yyyy")}
        </span>
        <span className="text-xs text-text-muted">
          {currentFrame + 1} / {frames.length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[500px]">
          <EvidenceGraph data={graphData} height={500} />
        </div>
        <div>
          <SectionHeader title="Events at this point" />
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {frame.events.map((e) => (
              <div key={e.id} className="surface p-3">
                <p className="text-sm font-medium">{e.title}</p>
              </div>
            ))}
            {frame.events.length === 0 && (
              <p className="text-sm text-text-muted">No new events at this timestamp</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
