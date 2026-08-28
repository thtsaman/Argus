"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import type { GraphData } from "@/lib/graph/analysis";
import { format } from "date-fns";

type Stage = "select" | "graph" | "path" | "timeline" | "geographic";

interface BridgeEntity {
  entityId: string;
  label: string;
  score: number;
  description: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  occurredAt: string;
  location?: { name: string; latitude: number; longitude: number } | null;
}

export default function BridgeViewPage() {
  const { id } = useParams<{ id: string }>();
  const [stage, setStage] = useState<Stage>("select");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [bridges, setBridges] = useState<BridgeEntity[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<BridgeEntity | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/investigations/${id}/graph`).then((r) => r.json()),
      fetch(`/api/investigations/${id}/bridges`).then((r) => r.json()),
    ]).then(([graph, bridgeData]) => {
      setGraphData(graph);
      setBridges(bridgeData.bridges || []);
      setLoading(false);
    });
  }, [id]);

  const revealConnection = async (bridge: BridgeEntity) => {
    setSelectedBridge(bridge);
    setStage("graph");

    const connectedLinks = graphData?.links.filter(
      (l) => l.source === bridge.entityId || l.target === bridge.entityId
    );
    const connectedIds = new Set<string>([bridge.entityId]);
    connectedLinks?.forEach((l) => {
      connectedIds.add(l.source);
      connectedIds.add(l.target);
    });

    const pathNodes = [...connectedIds];
    setPath(pathNodes);

    setTimeout(() => setStage("path"), 800);
    setTimeout(() => setStage("timeline"), 1600);

    const res = await fetch(`/api/investigations/${id}/events?entityIds=${pathNodes.join(",")}`);
    const data = await res.json();
    setEvents(data.events || []);

    setTimeout(() => setStage("geographic"), 2400);
  };

  if (loading) return <div className="p-8"><LoadingState /></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title="Bridge View"
        description="Progressive revelation of structural connections — from graph to timeline to geography."
      />

      <AnimatePresence mode="wait">
        {stage === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionHeader
              title="Structural bridge entities"
              subtitle="Entities that connect otherwise separate groups in the network"
            />
            <div className="space-y-3">
              {bridges.map((bridge) => (
                <button
                  key={bridge.entityId}
                  onClick={() => revealConnection(bridge)}
                  className="w-full text-left surface-elevated p-5 hover:border-border-strong transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-serif text-lg font-medium">{bridge.label}</p>
                      <p className="text-sm text-text-secondary mt-1">{bridge.description}</p>
                    </div>
                    <span className="text-xs text-text-muted">Score: {bridge.score.toFixed(1)}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {(stage === "graph" || stage === "path" || stage === "timeline" || stage === "geographic") && selectedBridge && graphData && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-6">
              {(["graph", "path", "timeline", "geographic"] as Stage[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      stage === s || (["graph", "path", "timeline", "geographic"].indexOf(stage) > i)
                        ? "bg-accent text-surface-elevated"
                        : "border border-border text-text-muted"
                    }`}
                  >
                    {s === "graph" ? "Connection" : s === "path" ? "Path" : s === "timeline" ? "Timeline" : "Geographic"}
                  </span>
                  {i < 3 && <span className="text-text-muted">→</span>}
                </div>
              ))}
              <button
                onClick={() => { setStage("select"); setSelectedBridge(null); setPath([]); }}
                className="ml-auto text-xs px-3 py-1 border border-border rounded hover:border-border-strong"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[400px]">
                <EvidenceGraph
                  data={graphData}
                  selectedNodeId={selectedBridge.entityId}
                  highlightedPath={path}
                  highlightedNodes={new Set(path)}
                  height={400}
                />
              </div>

              <div className="space-y-4">
                {(stage === "timeline" || stage === "geographic") && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
                    <SectionHeader title="Timeline context" subtitle="Events along the connection path" />
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {events.map((e) => (
                        <div key={e.id} className="flex justify-between text-sm border-b border-border pb-2">
                          <span>{e.title}</span>
                          <time className="text-xs text-text-muted">{format(new Date(e.occurredAt), "dd MMM yyyy")}</time>
                        </div>
                      ))}
                      {events.length === 0 && <p className="text-sm text-text-muted">No events along this path</p>}
                    </div>
                  </motion.div>
                )}

                {stage === "geographic" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated p-4">
                    <SectionHeader title="Geographic context" subtitle="Locations associated with path events" />
                    <div className="space-y-2">
                      {[...new Map(events.filter((e) => e.location).map((e) => [e.location!.name, e.location])).values()].map(
                        (loc) => loc && (
                          <div key={loc.name} className="text-sm flex justify-between">
                            <span>{loc.name}</span>
                            <span className="text-xs text-text-muted">{loc.latitude.toFixed(2)}, {loc.longitude.toFixed(2)}</span>
                          </div>
                        )
                      )}
                    </div>
                  </motion.div>
                )}

                <div className="surface p-4">
                  <p className="text-sm text-text-secondary">
                    {selectedBridge.description}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
