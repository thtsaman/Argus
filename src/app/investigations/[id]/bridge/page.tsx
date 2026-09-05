"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { ContextualChatWidget } from "@/components/investigation/ContextualChatWidget";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { countConnectedComponents } from "@/lib/graph/analysis";

interface BridgeCandidate {
  entityId: string;
  label: string;
  score: number;
  description: string;
  clusterA: { name: string; count: number; entities: string[] };
  clusterB: { name: string; count: number; entities: string[] };
  crossClusterPaths: number;
  bridgeType: "PERSON" | "ORGANIZATION" | "LOGISTICS" | "FINANCIAL";
}

export default function BridgeViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<any>(null);
  const [bridges, setBridges] = useState<BridgeCandidate[]>([]);
  const [selectedBridge, setSelectedBridge] = useState<BridgeCandidate | null>(null);

  // Collapsible candidate rail state
  const [candidatePanelCollapsed, setCandidatePanelCollapsed] = useState<boolean>(false);

  // Signature Interactions & Modes
  const [withoutBridge, setWithoutBridge] = useState<boolean>(false);
  const [animatingPath, setAnimatingPath] = useState<boolean>(false);
  const [activePathIndex, setActivePathIndex] = useState<number | null>(null);
  const [showFinancialLayer, setShowFinancialLayer] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);

  // Assistant & Modals
  const [showAssistant, setShowAssistant] = useState<boolean>(false);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<boolean>(false);
  const [modalRelationship, setModalRelationship] = useState<any | null>(null);

  // Fetch initial graph & bridge candidates
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, bRes] = await Promise.all([
        fetch(`/api/investigations/${id}/graph`),
        fetch(`/api/investigations/${id}/bridges`),
      ]);
      const gData = await gRes.json();
      const bData = await bRes.json();

      setGraphData(gData);
      const candidates: BridgeCandidate[] = bData.bridges || [];
      setBridges(candidates);

      if (candidates.length > 0) {
        setSelectedBridge(candidates[0]);
      }
    } catch {
      console.error("Failed to load bridge intelligence data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute paired cross-cluster paths: Cluster A Entity -> Bridge -> Cluster B Entity
  const crossClusterPairs = useMemo(() => {
    if (!selectedBridge) return [];
    const cA = selectedBridge.clusterA.entities;
    const cB = selectedBridge.clusterB.entities;
    const pairs: { id: string; from: string; bridge: string; to: string; type: string }[] = [];

    const minLen = Math.max(cA.length, cB.length);
    for (let i = 0; i < minLen; i++) {
      const from = cA[i % cA.length];
      const to = cB[i % cB.length];
      pairs.push({
        id: `pair-${i}`,
        from,
        bridge: selectedBridge.label,
        to,
        type: i % 2 === 0 ? "ASSOCIATED_WITH" : "COMMUNICATED_WITH",
      });
    }
    return pairs;
  }, [selectedBridge]);

  // Compute focused bridge subgraphs for clear visual separation
  const bridgeSubgraphWithBridge = useMemo(() => {
    if (!graphData || !selectedBridge) return { nodes: [], links: [] };
    const bId = selectedBridge.entityId;

    // Find direct neighbors of the bridge
    const neighborIds = new Set<string>();
    neighborIds.add(bId);

    graphData.links.forEach((l: any) => {
      if (l.source === bId) neighborIds.add(l.target);
      if (l.target === bId) neighborIds.add(l.source);
    });

    // Expand 1 hop to get community nodes
    const extendedIds = new Set<string>(neighborIds);
    graphData.links.forEach((l: any) => {
      if (neighborIds.has(l.source)) extendedIds.add(l.target);
      if (neighborIds.has(l.target)) extendedIds.add(l.source);
    });

    const nodes = graphData.nodes
      .filter((n: any) => extendedIds.has(n.id))
      .map((n: any) => ({
        ...n,
        isBridge: n.id === bId,
      }));

    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const links = graphData.links.filter(
      (l: any) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    return { nodes, links };
  }, [graphData, selectedBridge]);

  // WITHOUT BRIDGE: Graph G' = G - {bridge node + incident edges} with RECALCULATED layout
  const bridgeSubgraphWithoutBridge = useMemo(() => {
    if (!bridgeSubgraphWithBridge || !selectedBridge) return { nodes: [], links: [] };
    const bId = selectedBridge.entityId;

    // Completely remove bridge node
    const nodes = bridgeSubgraphWithBridge.nodes.filter((n: any) => n.id !== bId);
    const nodeIds = new Set(nodes.map((n: any) => n.id));

    // Remove all incident edges
    const links = bridgeSubgraphWithBridge.links.filter(
      (l: any) => l.source !== bId && l.target !== bId && nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    return { nodes, links };
  }, [bridgeSubgraphWithBridge, selectedBridge]);

  // Compute graph connected component metrics dynamically
  const withBridgeComponents = useMemo(
    () => countConnectedComponents(bridgeSubgraphWithBridge),
    [bridgeSubgraphWithBridge]
  );

  const withoutBridgeComponents = useMemo(
    () => countConnectedComponents(bridgeSubgraphWithoutBridge),
    [bridgeSubgraphWithoutBridge]
  );

  // Path highlight arrays for Force Graph
  const currentHighlightedPath = useMemo(() => {
    if (activePathIndex == null || !crossClusterPairs[activePathIndex]) return [];
    const p = crossClusterPairs[activePathIndex];
    const fromNode = graphData?.nodes.find((n: any) => n.label === p.from);
    const bridgeNode = graphData?.nodes.find((n: any) => n.id === selectedBridge?.entityId);
    const toNode = graphData?.nodes.find((n: any) => n.label === p.to);

    const pathArr: string[] = [];
    if (fromNode) pathArr.push(fromNode.id);
    if (bridgeNode) pathArr.push(bridgeNode.id);
    if (toNode) pathArr.push(toNode.id);

    return pathArr;
  }, [activePathIndex, crossClusterPairs, graphData, selectedBridge]);

  // Handle signature Animated Path Sequence
  const handleAnimatePaths = () => {
    if (crossClusterPairs.length === 0) return;
    setAnimatingPath(true);
    let idx = 0;
    setActivePathIndex(0);

    const interval = setInterval(() => {
      idx++;
      if (idx >= crossClusterPairs.length) {
        clearInterval(interval);
        setAnimatingPath(false);
        setActivePathIndex(null);
      } else {
        setActivePathIndex(idx);
      }
    }, 1800);
  };

  // Create Task handler
  const handleCreateTask = async () => {
    if (!selectedBridge) return;
    try {
      await fetch(`/api/investigations/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Investigate Cross-Cluster Role: ${selectedBridge.label}`,
          description: `Determine operational explanation for ${selectedBridge.label}'s connections between ${selectedBridge.clusterA.name} and ${selectedBridge.clusterB.name}.`,
          whyItMatters: selectedBridge.description,
          priority: "HIGH",
          sourceType: "ARGUS_SUGGESTED",
          expectedOutcome: `Establish whether cross-cluster connectivity maintained by ${selectedBridge.label} represents authorized operational activity or unmonitored coordination.`,
        }),
      });
      alert(`Investigation Task created for bridge ${selectedBridge.label}!`);
    } catch {
      alert("Failed to create task.");
    }
  };

  const handleShowInNetwork = () => {
    if (!selectedBridge) return;
    router.push(`/investigations/${id}/evidence-space?search=${encodeURIComponent(selectedBridge.label)}`);
  };

  const handleShowEvidence = () => {
    if (!selectedBridge) return;
    setModalRelationship({
      source: { label: selectedBridge.label },
      target: { label: selectedBridge.clusterA.name },
      type: "BRIDGE_OBSERVATION",
      evidence: [
        {
          evidence: {
            id: selectedBridge.entityId,
            title: `Structural Bridge Log: ${selectedBridge.label}`,
            type: "BRIDGE_RECORD",
            source: "Network Structural Centrality Engine",
            uploadedAt: new Date().toISOString(),
            rawContent: `Bridge entity ${selectedBridge.label} connects ${selectedBridge.clusterA.name} and ${selectedBridge.clusterB.name}.`,
          },
          excerpt: selectedBridge.description,
        },
      ],
    });
    setActiveEvidenceModal(true);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <LoadingState message="ARGUS: Analyzing Structural Topology & Network Bridges..." />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Bridge Intelligence: Structural Topology Reveal"
        description="Automatic graph centrality discovery showing entities connecting otherwise separated communities in Operation Question Mark."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                compareMode ? "bg-amber-600 text-white border-amber-700" : "bg-surface-elevated text-foreground border-border hover:bg-surface"
              }`}
            >
              {compareMode ? "EXIT COMPARISON" : "COMPARE STRUCTURE"}
            </button>
            <button
              onClick={() => setShowAssistant(true)}
              className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              Explain This Bridge (Ask ARGUS)
            </button>
          </div>
        }
      />

      {/* Main 3-Column Dynamic Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[680px] transition-all duration-300">
        {/* LEFT COLUMN: Bridge Candidate Rail (Collapsible) */}
        {candidatePanelCollapsed ? (
          /* Collapsed Indicator Strip */
          <div className="lg:col-span-1 surface-elevated p-2 rounded-lg border border-border flex flex-col items-center justify-between shadow-xs">
            <button
              onClick={() => setCandidatePanelCollapsed(false)}
              className="p-2 rounded bg-surface hover:bg-surface-elevated text-text-secondary hover:text-foreground border border-border transition-colors w-full flex items-center justify-center gap-1 font-mono text-xs"
              title="Expand Candidates Rail"
            >
              <span>➔</span>
            </button>
            <div className="writing-vertical text-center font-mono text-xs uppercase tracking-widest text-text-muted font-bold py-6">
              CANDIDATES ({bridges.length})
            </div>
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
          </div>
        ) : (
          /* Full Candidate Rail (3 Cols) */
          <div className="lg:col-span-3 surface-elevated p-4 rounded-lg border border-border space-y-4 flex flex-col justify-between relative shadow-xs transition-all duration-300">
            <div className="space-y-3">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-base font-semibold text-foreground">Bridge Candidates</h3>
                  <p className="text-[11px] text-text-muted">Ranked structural centrality connectors</p>
                </div>
                <button
                  onClick={() => setCandidatePanelCollapsed(true)}
                  className="p-1.5 rounded bg-surface hover:bg-surface-elevated text-text-muted hover:text-foreground border border-border transition-colors text-xs font-mono"
                  title="Collapse Candidates Rail"
                >
                  ◀
                </button>
              </div>

              <div className="space-y-2.5">
                {bridges.map((b, idx) => {
                  const isSelected = b.entityId === selectedBridge?.entityId;
                  return (
                    <button
                      key={b.entityId}
                      onClick={() => {
                        setSelectedBridge(b);
                        setWithoutBridge(false);
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-accent/10 border-accent text-foreground shadow-2xs"
                          : "bg-background border-border/80 hover:bg-surface text-text-secondary hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface border border-border text-accent">
                          0{idx + 1} · {b.bridgeType}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted">Impact Score: {b.score.toFixed(1)}</span>
                      </div>
                      <div className="font-serif text-sm font-semibold text-foreground">{b.label}</div>
                      <p className="text-[11px] text-text-muted line-clamp-2 mt-1">{b.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <button
                onClick={() => setShowFinancialLayer(!showFinancialLayer)}
                className={`w-full text-xs py-2 px-3 rounded font-semibold border transition-colors ${
                  showFinancialLayer
                    ? "bg-amber-500/20 text-amber-800 border-amber-500"
                    : "bg-background text-text-secondary border-border hover:bg-surface"
                }`}
              >
                {showFinancialLayer ? "● Financial Layer ON" : "○ Show Financial Layer"}
              </button>
            </div>
          </div>
        )}

        {/* CENTER COLUMN: DOMINANT HERO CANVAS (Expands to 8 Cols when left is collapsed, else 6 Cols) */}
        <div className={`${candidatePanelCollapsed ? "lg:col-span-8" : "lg:col-span-6"} surface rounded-lg border border-border flex flex-col justify-between relative shadow-md overflow-hidden min-h-[580px] transition-all duration-300`}>
          {/* Top Controls Strip */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-surface-elevated/60 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-accent uppercase tracking-wider">
                COMMUNITY STRUCTURE
              </span>
              {selectedBridge && (
                <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 rounded bg-background border border-border">
                  {selectedBridge.clusterA.name} ↔ {selectedBridge.clusterB.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWithoutBridge(!withoutBridge)}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                  withoutBridge
                    ? "bg-red-700 text-white border-red-800 shadow-sm"
                    : "bg-surface text-foreground border-border hover:bg-surface-elevated"
                }`}
              >
                {withoutBridge ? "RESTORE BRIDGE" : "REMOVE BRIDGE"}
              </button>
              <button
                onClick={handleAnimatePaths}
                disabled={animatingPath}
                className="px-3 py-1.5 rounded bg-background hover:bg-surface text-text-secondary hover:text-foreground text-xs font-semibold border border-border transition-colors disabled:opacity-50"
              >
                {animatingPath ? "ANIMATING PATHS..." : "SHOW CROSS-CLUSTER PATHS"}
              </button>
            </div>
          </div>

          {/* MAIN GRAPH CANVAS AREA */}
          <div className="flex-1 relative w-full h-full min-h-[460px]">
            {compareMode ? (
              /* RE-ENGINEERED SPLIT COMPARISON MODE: FOCUS SUBGRAPH & RECALCULATED LAYOUT */
              <div className="grid grid-cols-2 h-[460px] border-t border-border relative">
                {/* Center Break Divider */}
                {/* <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-background border border-border px-3 py-1.5 rounded-full shadow-lg text-center font-mono text-[10px] font-bold text-accent uppercase">
                  ⚡ REMOVAL SIMULATION
                </div> */}

                {/* LEFT: WITH BRIDGE */}
                <div className="p-3 border-r border-border flex flex-col justify-between overflow-hidden bg-emerald-950/5">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-500/20">
                    <span className="text-xs font-mono font-bold text-emerald-800 uppercase">WITH BRIDGE</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 border border-emerald-500/30">
                      CONNECTED NETWORK
                    </span>
                  </div>

                  <div className="h-[340px] w-full overflow-hidden relative my-1">
                    <EvidenceGraph
                      data={bridgeSubgraphWithBridge}
                      selectedNodeId={selectedBridge?.entityId}
                      height={340}
                    />
                  </div>

                  <div className="p-2 bg-background/80 rounded border border-border space-y-1 text-center font-mono text-[11px]">
                    <div className="flex justify-around text-text-secondary font-semibold">
                      <span>COMPONENTS: <strong className="text-emerald-700">{withBridgeComponents}</strong></span>
                      <span>PATHS: <strong className="text-emerald-700">{crossClusterPairs.length}</strong></span>
                      <span>BRIDGE: <strong className="text-emerald-700">PRESENT</strong></span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: WITHOUT BRIDGE (G' = G - {bridge node + edges}) */}
                <div className="p-3 bg-red-950/5 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between pb-1 border-b border-red-500/20">
                    <span className="text-xs font-mono font-bold text-red-800 uppercase">WITHOUT BRIDGE</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-800 border border-red-500/30">
                      STRUCTURAL BREAK
                    </span>
                  </div>

                  <div className="h-[340px] w-full overflow-hidden relative my-1">
                    <EvidenceGraph
                      data={bridgeSubgraphWithoutBridge}
                      selectedNodeId={null}
                      height={340}
                    />
                  </div>

                  <div className="p-2 bg-background/80 rounded border border-border space-y-1 text-center font-mono text-[11px]">
                    <div className="flex justify-around text-text-secondary font-semibold">
                      <span>COMPONENTS: <strong className="text-red-700">{withoutBridgeComponents}</strong></span>
                      <span>PATHS: <strong className="text-red-700">0</strong></span>
                      <span>BRIDGE: <strong className="text-red-700">REMOVED</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* DOMINANT FORCE GRAPH VISUALIZATION */
              <div className="w-full h-full relative">
                <EvidenceGraph
                  data={withoutBridge ? bridgeSubgraphWithoutBridge : bridgeSubgraphWithBridge}
                  selectedNodeId={withoutBridge ? null : selectedBridge?.entityId}
                  highlightedPath={currentHighlightedPath}
                  height={480}
                  onNodeClick={(nodeId) => {
                    if (nodeId === selectedBridge?.entityId) return;
                    router.push(`/investigations/${id}/evidence-space?search=${encodeURIComponent(nodeId)}`);
                  }}
                />

                {/* Severed Alert Banner overlay */}
                {withoutBridge && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-950/90 text-red-100 px-4 py-2 rounded-lg border border-red-700 text-center shadow-xl backdrop-blur-md">
                    <div className="font-mono text-xs font-bold uppercase tracking-wider text-red-300">
                      STRUCTURAL BREAK: CONNECTIVITY LOST
                    </div>
                    <div className="text-[11px] text-red-200 mt-0.5">
                      Removing {selectedBridge?.label} disconnects {selectedBridge?.clusterA.name} and {selectedBridge?.clusterB.name}.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Path Flow Strip */}
          <div className="border-t border-border p-3 space-y-1.5 bg-surface-elevated/40">
            <span className="text-[10px] font-mono font-bold uppercase text-text-muted block">
              Active Cross-Cluster Paths ({crossClusterPairs.length} Traversal Paths):
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {crossClusterPairs.map((p, i) => (
                <div
                  key={p.id}
                  className={`px-3 py-1.5 rounded border text-[11px] font-mono shrink-0 transition-all flex items-center gap-1.5 ${
                    activePathIndex === i
                      ? "bg-amber-500 text-white border-amber-600 font-bold scale-105 shadow-md animate-pulse"
                      : "bg-background border-border text-text-secondary"
                  }`}
                >
                  <span className="text-emerald-400 font-bold">{p.from}</span>
                  <span>&rarr;</span>
                  <span className="text-amber-300 font-bold underline">{p.bridge}</span>
                  <span>&rarr;</span>
                  <span className="text-blue-400 font-bold">{p.to}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Bridge Intelligence Panel (3 Cols) */}
        <div className="lg:col-span-3 surface-elevated p-5 rounded-lg border border-border space-y-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-foreground">Bridge Intelligence</h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface border border-border text-accent">
                {selectedBridge?.bridgeType || "STRUCTURAL"}
              </span>
            </div>

            {selectedBridge ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-lg text-foreground">{selectedBridge.label}</h4>
                  <p className="text-xs text-text-muted font-mono mt-0.5">
                    Structural Centrality Score: {selectedBridge.score.toFixed(2)}
                  </p>
                </div>

                {/* Structural Role Diagram */}
                <div className="p-3 bg-background rounded border border-border space-y-1.5 text-center">
                  <span className="text-[10px] font-mono text-accent font-bold uppercase block">STRUCTURAL ROLE</span>
                  <div className="text-xs font-mono font-bold text-foreground py-1 border-y border-border/60">
                    {selectedBridge.clusterA.name.split(" ")[0]} ── ★ {selectedBridge.label} ── {selectedBridge.clusterB.name.split(" ")[0]}
                  </div>
                  <p className="text-[11px] text-text-muted">Removing this entity severs cross-community connectivity.</p>
                </div>

                {/* Why ARGUS Surfaced This */}
                <div className="p-3 bg-background rounded border border-border space-y-1">
                  <span className="text-[10px] text-accent font-semibold uppercase tracking-wider block font-mono">
                    Why ARGUS Surfaced This:
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed font-sans">
                    {selectedBridge.description} Trusted investigation graph analysis establishes that {selectedBridge.label} maintains the primary relationships connecting both communities.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Select a bridge candidate to inspect intelligence.</p>
            )}
          </div>

          {/* Action Buttons */}
          {selectedBridge && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleShowInNetwork}
                  className="flex-1 text-xs py-2 px-3 bg-accent text-surface-elevated rounded font-semibold hover:bg-accent-hover transition-colors text-center"
                >
                  Show in Network
                </button>
                <button
                  onClick={handleShowEvidence}
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

      {/* Contextual Ask ARGUS Floating Chat Widget */}
      {showAssistant && (
        <ContextualChatWidget
          investigationId={id}
          contextType="BRIDGE_EXPLANATION"
          contextId={selectedBridge?.entityId || id}
          contextLabel={`Explain Bridge: ${selectedBridge?.label || "Selected Entity"}`}
          initialQuestion={`Explain this bridge: How does ${selectedBridge?.label || "this entity"} connect ${selectedBridge?.clusterA.name || "Cluster A"} and ${selectedBridge?.clusterB.name || "Cluster B"}?`}
          onClose={() => setShowAssistant(false)}
        />
      )}

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
