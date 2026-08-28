"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import type { GraphData } from "@/lib/graph/analysis";
import { format } from "date-fns";

const InvestigationMap = dynamic(() => import("@/components/map/InvestigationMap"), { ssr: false });

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
  description?: string | null;
  location?: { name: string; latitude: number; longitude: number } | null;
}

export default function BridgeViewPage() {
  const { id } = useParams<{ id: string }>();
  const [stage, setStage] = useState<Stage>("select");
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [bridges, setBridges] = useState<BridgeEntity[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<BridgeEntity | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [depthFilter, setDepthFilter] = useState<"1hop" | "all">("1hop");

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

  const selectBridge = async (bridge: BridgeEntity) => {
    setSelectedBridge(bridge);
    setActiveNodeId(bridge.entityId);
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

    const res = await fetch(`/api/investigations/${id}/events?entityIds=${pathNodes.join(",")}`);
    const data = await res.json();
    setEvents(data.events || []);
  };

  const activeNodeInfo = useMemo(() => {
    if (!activeNodeId || !graphData) return null;
    const node = graphData.nodes.find((n) => n.id === activeNodeId);
    if (!node) return null;

    const rels = graphData.links.filter(
      (l) => l.source === activeNodeId || l.target === activeNodeId
    );

    const neighborIds = rels.map((l) => (l.source === activeNodeId ? l.target : l.source));
    const neighbors = graphData.nodes.filter((n) => neighborIds.includes(n.id));

    return { node, rels, neighbors };
  }, [activeNodeId, graphData]);

  // Dynamic graph data filtered by 1-hop vs all
  const filteredGraphData = useMemo(() => {
    if (!graphData || !selectedBridge) return graphData;
    if (depthFilter === "all") return graphData;

    const hop1Ids = new Set<string>([selectedBridge.entityId]);
    graphData.links.forEach((l) => {
      if (l.source === selectedBridge.entityId) hop1Ids.add(l.target);
      if (l.target === selectedBridge.entityId) hop1Ids.add(l.source);
    });

    const nodes = graphData.nodes.filter((n) => hop1Ids.has(n.id));
    const links = graphData.links.filter(
      (l) => hop1Ids.has(l.source) && hop1Ids.has(l.target)
    );

    return { nodes, links };
  }, [graphData, selectedBridge, depthFilter]);

  // Connected links for Path View
  const bridgeRelationships = useMemo(() => {
    if (!graphData || !selectedBridge) return [];
    const rels = graphData.links.filter(
      (l) => l.source === selectedBridge.entityId || l.target === selectedBridge.entityId
    );
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));

    return rels.map((r) => {
      const otherId = r.source === selectedBridge.entityId ? r.target : r.source;
      const otherNode = nodeMap.get(otherId);
      return {
        relationship: r,
        connectedEntity: otherNode,
        isSource: r.source === selectedBridge.entityId,
      };
    });
  }, [graphData, selectedBridge]);

  // Format map locations for Geographic View
  const mapLocations = useMemo(() => {
    const locMap = new Map<
      string,
      {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        region: string | null;
        events: { id: string; title: string; occurredAt: string }[];
      }
    >();

    events.forEach((e) => {
      if (e.location) {
        if (!locMap.has(e.location.name)) {
          locMap.set(e.location.name, {
            id: e.location.name,
            name: e.location.name,
            latitude: e.location.latitude,
            longitude: e.location.longitude,
            region: null,
            events: [],
          });
        }
        locMap.get(e.location.name)!.events.push({ id: e.id, title: e.title, occurredAt: e.occurredAt });
      }
    });
    return [...locMap.values()];
  }, [events]);

  if (loading) return <div className="p-8"><LoadingState /></div>;

  const STAGES: { id: Stage; label: string; icon: string }[] = [
    { id: "graph", label: "Network View", icon: "🕸️" },
    { id: "path", label: "Connection Path", icon: "🔗" },
    { id: "timeline", label: "Timeline", icon: "📅" },
    { id: "geographic", label: "Geographic Map", icon: "📍" },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title="Interactive Bridge View"
        description="Explore structural bridges connecting separate entity groups. Switch tabs to view Network Graph, Connection Paths, Timeline, or Geographic Maps."
      />

      <AnimatePresence mode="wait">
        {stage === "select" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SectionHeader
              title="Select a Structural Bridge Entity"
              subtitle="Key individuals or entities that connect otherwise isolated clusters in this investigation"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bridges.map((bridge) => (
                <button
                  key={bridge.entityId}
                  onClick={() => selectBridge(bridge)}
                  className="text-left surface-elevated p-5 hover:border-accent hover:shadow-md transition-all group rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-serif text-lg font-semibold group-hover:text-accent transition-colors">
                      {bridge.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">
                      Score {bridge.score.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-3 mb-4">{bridge.description}</p>
                  <span className="text-xs text-accent font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Explore Bridge Connections &rarr;
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {stage !== "select" && selectedBridge && graphData && (
          <motion.div key="interactive-reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Top Navigation & Toolbar Bar */}
            <div className="surface-elevated p-4 mb-6 rounded-lg border border-border flex flex-wrap items-center justify-between gap-4">
              {/* Active Bridge Switcher */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Bridge Entity:</span>
                <select
                  value={selectedBridge.entityId}
                  onChange={(e) => {
                    const b = bridges.find((x) => x.entityId === e.target.value);
                    if (b) selectBridge(b);
                  }}
                  className="text-sm px-3 py-1.5 rounded border border-border bg-background font-medium hover:border-border-strong transition-colors cursor-pointer"
                >
                  {bridges.map((b) => (
                    <option key={b.entityId} value={b.entityId}>
                      {b.label} (Score: {b.score.toFixed(1)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Distinct Interactive Tab Selector */}
              <div className="flex items-center gap-1 bg-background p-1 rounded-md border border-border">
                {STAGES.map((s) => {
                  const isActive = stage === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setStage(s.id)}
                      className={`px-3.5 py-1.5 text-xs rounded transition-all flex items-center gap-2 ${
                        isActive
                          ? "bg-accent text-surface-elevated font-semibold shadow-sm"
                          : "text-text-secondary hover:text-foreground hover:bg-surface-elevated font-medium"
                      }`}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {stage === "graph" && (
                  <button
                    onClick={() => setDepthFilter(depthFilter === "1hop" ? "all" : "1hop")}
                    className="text-xs px-3 py-1.5 border border-border rounded hover:border-border-strong transition-colors bg-background font-medium"
                  >
                    Filter: {depthFilter === "1hop" ? "1-Hop Network" : "Full Network"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setStage("select");
                    setSelectedBridge(null);
                    setActiveNodeId(null);
                    setPath([]);
                  }}
                  className="text-xs px-3 py-1.5 border border-border rounded hover:border-border-strong text-text-secondary hover:text-foreground transition-colors"
                >
                  Back to List
                </button>
              </div>
            </div>

            {/* TAB 1: NETWORK VIEW (Graph + Inspector) */}
            {stage === "graph" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <div className="h-[540px] rounded-lg overflow-hidden border border-border relative">
                    <EvidenceGraph
                      data={filteredGraphData || graphData}
                      selectedNodeId={activeNodeId}
                      highlightedPath={path}
                      highlightedNodes={new Set(path)}
                      onNodeClick={(nodeId) => setActiveNodeId(nodeId)}
                      height={540}
                    />
                    <div className="absolute top-3 left-3 bg-surface-elevated/90 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      <span>Click any node to inspect details</span>
                    </div>
                  </div>

                  <div className="surface p-4 rounded-lg border border-border flex items-center justify-between text-xs text-text-secondary">
                    <span>Showing {filteredGraphData?.nodes.length} connected entities & {filteredGraphData?.links.length} relationships</span>
                    <span>Active Selection: <strong>{activeNodeInfo?.node.label || selectedBridge.label}</strong></span>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeNodeInfo ? (
                    <div className="surface-elevated p-5 rounded-lg border border-border shadow-sm space-y-4">
                      <div className="flex justify-between items-start border-b border-border pb-3">
                        <div>
                          <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
                            {activeNodeInfo.node.type}
                          </span>
                          <h3 className="font-serif text-xl font-semibold mt-1 text-foreground">
                            {activeNodeInfo.node.label}
                          </h3>
                        </div>
                        {activeNodeInfo.node.id === selectedBridge.entityId && (
                          <span className="text-xs bg-status-verified/10 text-status-verified px-2 py-1 rounded font-medium border border-status-verified/20">
                            Bridge Point
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-text-muted mb-1.5 font-medium">Direct Connections ({activeNodeInfo.neighbors.length}):</p>
                        <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                          {activeNodeInfo.neighbors.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => setActiveNodeId(n.id)}
                              className="text-xs px-2.5 py-1 rounded bg-background hover:bg-surface border border-border hover:border-accent text-text-secondary hover:text-foreground transition-all"
                            >
                              {n.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="surface p-5 rounded-lg border border-border text-center text-text-muted text-sm">
                      Click a node on the graph to inspect entity details.
                    </div>
                  )}

                  <div className="surface p-5 rounded-lg border border-border space-y-2">
                    <h4 className="font-serif text-sm font-semibold text-foreground">Bridge Structural Overview</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{selectedBridge.description}</p>
                    <div className="pt-2 border-t border-border flex justify-between items-center text-xs text-text-muted">
                      <span>Betweenness Score:</span>
                      <span className="font-semibold text-accent">{selectedBridge.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: CONNECTION PATH VIEW (Link & Flow List) */}
            {stage === "path" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="surface-elevated p-6 rounded-lg border border-border">
                  <SectionHeader
                    title={`Direct Path Connections for ${selectedBridge.label}`}
                    subtitle="Showing all direct associations, communications, and financial links passing through this bridge entity"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {bridgeRelationships.map(({ relationship, connectedEntity, isSource }) => (
                      <div
                        key={relationship.id}
                        className="surface p-4 rounded-lg border border-border hover:border-accent transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-accent/10 text-accent">
                            {relationship.type}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded border border-border text-text-muted uppercase">
                            {relationship.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 py-2 text-sm font-medium">
                          <span className="text-foreground">{isSource ? selectedBridge.label : connectedEntity?.label}</span>
                          <span className="text-accent text-base">&rarr;</span>
                          <span className="text-foreground">{isSource ? connectedEntity?.label : selectedBridge.label}</span>
                        </div>

                        {connectedEntity && (
                          <div className="flex justify-between items-center text-xs text-text-muted pt-2 border-t border-border">
                            <span>Connected Entity Type: <strong className="text-foreground">{connectedEntity.type}</strong></span>
                            {relationship.confidence != null && (
                              <span>Confidence: <strong>{Math.round(relationship.confidence * 100)}%</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: TIMELINE VIEW (Chronological Event Stream) */}
            {stage === "timeline" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="surface-elevated p-6 rounded-lg border border-border">
                  <SectionHeader
                    title="Chronological Event Timeline"
                    subtitle={`All recorded investigation events involving ${selectedBridge.label} and connected path entities`}
                  />
                  <div className="relative pl-6 border-l-2 border-accent/40 space-y-6 mt-6">
                    {events.map((e) => (
                      <div key={e.id} className="relative group">
                        {/* Timeline Node Dot */}
                        <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-accent border-2 border-surface-elevated group-hover:scale-125 transition-transform" />

                        <div className="surface p-4 rounded-lg border border-border hover:border-accent transition-colors space-y-1">
                          <div className="flex justify-between items-start gap-4">
                            <h4 className="font-serif text-base font-semibold text-foreground">{e.title}</h4>
                            <time className="text-xs px-2 py-1 bg-background rounded border border-border font-mono text-text-muted shrink-0">
                              {format(new Date(e.occurredAt), "dd MMM yyyy")}
                            </time>
                          </div>
                          {e.description && <p className="text-sm text-text-secondary">{e.description}</p>}
                          {e.location && (
                            <span className="text-xs text-accent font-medium inline-block mt-2">
                              📍 {e.location.name} ({e.location.latitude.toFixed(2)}, {e.location.longitude.toFixed(2)})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-sm text-text-muted py-6">No specific timeline events recorded along this path.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: GEOGRAPHIC MAP VIEW (Interactive OpenStreetMap) */}
            {stage === "geographic" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Leaflet Map */}
                <div className="lg:col-span-2 h-[540px] rounded-lg overflow-hidden border border-border shadow-sm">
                  <InvestigationMap locations={mapLocations} />
                </div>

                {/* Right Column: Location Cards */}
                <div className="space-y-4">
                  <div className="surface-elevated p-5 rounded-lg border border-border space-y-3">
                    <SectionHeader
                      title="Geographic Movement Locations"
                      subtitle="Locations linked to bridge events across districts"
                    />
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {mapLocations.map((loc) => (
                        <div
                          key={loc.name}
                          className="surface p-3.5 rounded-lg border border-border hover:border-accent transition-colors space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-serif text-sm font-semibold text-foreground">📍 {loc.name}</span>
                            <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded font-medium">
                              {loc.events.length} event(s)
                            </span>
                          </div>
                          <p className="text-xs text-text-muted font-mono">
                            Coordinates: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                          </p>
                        </div>
                      ))}
                      {mapLocations.length === 0 && (
                        <p className="text-xs text-text-muted py-6 text-center">No location coordinates recorded along this path.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
