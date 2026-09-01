"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import {
  EntityIntelligencePanel,
  FullEntityDetail,
  EntityContextData,
  HistoryItem,
} from "@/components/investigation/EntityIntelligencePanel";
import {
  RelationshipDetailPanel,
  RelationshipData,
} from "@/components/investigation/RelationshipDetail";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";
import type { GraphData } from "@/lib/graph/analysis";
import type { RelationshipStatus } from "@prisma/client";
import { motion } from "framer-motion";

export default function EvidenceSpacePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const leadSource = searchParams.get("source");
  const leadTarget = searchParams.get("target");

  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [entityDetail, setEntityDetail] = useState<FullEntityDetail | null>(null);
  const [entityContext, setEntityContext] = useState<EntityContextData | undefined>(undefined);
  const [relatedRels, setRelatedRels] = useState<RelationshipData[]>([]);

  // Entity navigation history/breadcrumbs
  const [entityHistory, setEntityHistory] = useState<HistoryItem[]>([]);

  // Active inspectors
  const [selectedRelationship, setSelectedRelationship] = useState<RelationshipData | null>(null);
  const [evidenceModalRelationship, setEvidenceModalRelationship] =
    useState<RelationshipData | null>(null);

  // Graph filters & path tracer
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [pathSource, setPathSource] = useState<string>("");
  const [pathTarget, setPathTarget] = useState<string>("");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [focusedRelationshipNodes, setFocusedRelationshipNodes] = useState<Set<string> | null>(null);

  const [loading, setLoading] = useState(true);
  const [pathLoading, setPathLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/investigations/${id}/graph`)
      .then((r) => r.json())
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      });
  }, [id]);

  const loadEntityDetail = useCallback(
    async (nodeId: string, customHistoryLabel?: string) => {
      setSelectedNode(nodeId);
      setSelectedRelationship(null);
      setFocusedRelationshipNodes(null);

      const res = await fetch(`/api/investigations/${id}/entities/${nodeId}`);
      const data = await res.json();
      const entity: FullEntityDetail = data.entity;

      setEntityDetail(entity);
      setEntityContext(data.context);
      setRelatedRels(data.relationships || []);

      const currentLabel = customHistoryLabel || entity?.label || nodeId;
      setEntityHistory((prev) => {
        if (prev.some((h) => h.id === nodeId)) {
          const existingIndex = prev.findIndex((h) => h.id === nodeId);
          return prev.slice(0, existingIndex + 1);
        }
        return [...prev, { id: nodeId, label: currentLabel }];
      });
    },
    [id]
  );

  useEffect(() => {
    if (leadSource) {
      if (leadTarget) {
        setFocusedRelationshipNodes(new Set([leadSource, leadTarget]));
      }
      loadEntityDetail(leadSource);
    }
  }, [leadSource, leadTarget, loadEntityDetail]);

  const handleSelectHistoryItem = (index: number) => {
    const item = entityHistory[index];
    if (item) {
      setEntityHistory((prev) => prev.slice(0, index + 1));
      loadEntityDetail(item.id, item.label);
    }
  };

  const handleSelectConnectedEntity = (connectedId: string, connectedLabel: string) => {
    loadEntityDetail(connectedId, connectedLabel);
  };

  const handleFocusGraphRelationship = (sourceId: string, targetId: string) => {
    setFocusedRelationshipNodes(new Set([sourceId, targetId]));
    setHighlightedPath([]);
  };

  const handleFocusGraphEntity = (entityId: string) => {
    setSelectedNode(entityId);
    setFocusedRelationshipNodes(null);
    setHighlightedPath([]);
  };

  const findPath = async () => {
    if (!pathSource || !pathTarget) return;
    setPathLoading(true);
    const res = await fetch(`/api/investigations/${id}/path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: pathSource, targetId: pathTarget }),
    });
    const data = await res.json();
    setPathLoading(false);
    if (data.paths?.[0]) {
      setHighlightedPath(data.paths[0]);
      setFocusedRelationshipNodes(null);
    } else {
      setHighlightedPath([]);
    }
  };

  const filteredGraphData = useMemo(() => {
    if (!graphData) return null;

    let nodes = graphData.nodes;
    if (typeFilter !== "ALL") {
      nodes = nodes.filter((n) => n.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      nodes = nodes.filter(
        (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
      );
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.links.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    return { nodes, links };
  }, [graphData, typeFilter, searchQuery]);

  const pathNodeLabels = useMemo(() => {
    if (!graphData || highlightedPath.length === 0) return [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    return highlightedPath.map((id) => nodeMap.get(id)).filter(Boolean);
  }, [graphData, highlightedPath]);

  const activeHighlightedNodes = useMemo(() => {
    if (focusedRelationshipNodes) return focusedRelationshipNodes;
    if (selectedNode) {
      return new Set([
        selectedNode,
        ...relatedRels.flatMap((r) => [r.source.id, r.target.id]),
      ]);
    }
    return undefined;
  }, [focusedRelationshipNodes, selectedNode, relatedRels]);

  if (loading)
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );

  const ENTITY_TYPES = ["ALL", "PERSON", "PHONE", "ACCOUNT", "ORGANIZATION", "VEHICLE", "LOCATION"];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Network Exploration & Entity Intelligence"
        description="Select any entity to inspect its intelligence profile, relationships, and supporting evidence without tracing repetitive connections."
      />

      {/* Primary Graph Filter Bar (Placed directly above graph) */}
      <div className="surface-elevated p-4 rounded-lg border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">
            Network
          </span>

          {/* Search Box */}
          <div className="relative min-w-[200px] max-w-xs">
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-border rounded px-3 py-1.5 bg-background focus:border-accent font-medium text-foreground transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-xs text-text-muted hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap gap-1 items-center">
            {ENTITY_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 text-xs rounded transition-all ${
                  typeFilter === t
                    ? "bg-accent text-surface-elevated font-semibold shadow-sm"
                    : "text-text-secondary hover:text-foreground hover:bg-background border border-border"
                }`}
              >
                {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-text-muted shrink-0 font-mono">
          Showing {filteredGraphData?.nodes.length} nodes & {filteredGraphData?.links.length} links
        </div>
      </div>

      {/* Main Grid: Graph + Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph & Path Controls */}
        <div className="lg:col-span-3 space-y-4">
          <div className="h-[620px] rounded-lg overflow-hidden border border-border relative">
            {filteredGraphData && (
              <EvidenceGraph
                data={filteredGraphData}
                selectedNodeId={selectedNode}
                highlightedPath={highlightedPath}
                highlightedNodes={activeHighlightedNodes}
                onNodeClick={(nodeId) => loadEntityDetail(nodeId)}
                height={620}
              />
            )}

            <div className="absolute top-3 left-3 bg-surface-elevated/90 backdrop-blur-xs px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>Select any node to view entity intelligence</span>
            </div>

            {focusedRelationshipNodes && (
              <div className="absolute top-3 right-3 bg-surface-elevated/90 backdrop-blur-xs px-3 py-1.5 rounded-md border border-accent text-xs text-foreground flex items-center gap-2">
                <span>Focused on relationship path</span>
                <button
                  onClick={() => setFocusedRelationshipNodes(null)}
                  className="text-text-muted hover:text-foreground font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Connection Path Tracer */}
          <div className="surface-elevated p-5 rounded-lg border border-border space-y-4">
            <SectionHeader
              title="Connection Path Tracer"
              subtitle="Select source and target entities to compute and highlight the shortest connection path"
            />
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-text-muted font-medium block mb-1">
                  Source Entity
                </label>
                <select
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="w-full text-sm border border-border rounded px-3 py-1.5 bg-background font-medium focus:border-accent transition-colors"
                >
                  <option value="">Select source entity...</option>
                  {graphData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-text-muted font-medium block mb-1">
                  Target Entity
                </label>
                <select
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="w-full text-sm border border-border rounded px-3 py-1.5 bg-background font-medium focus:border-accent transition-colors"
                >
                  <option value="">Select target entity...</option>
                  {graphData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={findPath}
                disabled={pathLoading || !pathSource || !pathTarget}
                className="text-sm px-5 py-1.5 bg-accent text-surface-elevated rounded font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-sm"
              >
                {pathLoading ? "Tracing..." : "Find Path"}
              </button>

              {highlightedPath.length > 0 && (
                <button
                  onClick={() => setHighlightedPath([])}
                  className="text-sm px-3.5 py-1.5 border border-border rounded hover:border-border-strong text-text-secondary hover:text-foreground transition-colors"
                >
                  Clear Path
                </button>
              )}
            </div>

            {/* Path Breadcrumb Visualization */}
            {pathNodeLabels.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-background border border-border space-y-2"
              >
                <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">
                  Discovered Connection Chain ({pathNodeLabels.length} hops):
                </span>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {pathNodeLabels.map((n, i) => (
                    <div key={n?.id} className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => n && loadEntityDetail(n.id)}
                        className="px-3 py-1 rounded bg-surface-elevated border border-border hover:border-accent text-xs font-medium text-foreground transition-colors"
                      >
                        <span className="text-[10px] text-accent block uppercase">{n?.type}</span>
                        {n?.label}
                      </button>
                      {i < pathNodeLabels.length - 1 && (
                        <span className="text-accent font-bold text-sm">&rarr;</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Entity Intelligence & Relationship Inspector */}
        <div className="space-y-4">
          <div className="surface-elevated p-4 rounded-lg border border-border space-y-3">
            <SectionHeader title="Relationship Legend" />
            <div className="flex flex-wrap gap-2">
              {(
                ["DIRECT", "VERIFIED", "UNDER_REVIEW", "AI_SUGGESTED", "REJECTED"] as RelationshipStatus[]
              ).map((s) => (
                <RelationshipStatusBadge key={s} status={s} />
              ))}
            </div>
          </div>

          {selectedRelationship ? (
            <RelationshipDetailPanel
              relationship={selectedRelationship}
              investigationId={id}
              onFocusGraph={handleFocusGraphRelationship}
              onViewEvidence={(rel) => setEvidenceModalRelationship(rel)}
              onClose={() => setSelectedRelationship(null)}
            />
          ) : entityDetail ? (
            <EntityIntelligencePanel
              entity={entityDetail}
              investigationId={id}
              context={entityContext}
              relationships={relatedRels}
              history={entityHistory}
              onSelectEntityFromHistory={handleSelectHistoryItem}
              onSelectConnectedEntity={handleSelectConnectedEntity}
              onSelectRelationship={(rel) => setSelectedRelationship(rel)}
              onFocusGraph={handleFocusGraphEntity}
            />
          ) : (
            <div className="surface p-8 rounded-lg border border-border text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No Entity Selected</p>
              <p className="text-xs text-text-muted">
                Click any node on the graph to open its Entity Intelligence panel and inspect its
                relationships and supporting evidence.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Supporting Evidence Modal */}
      {evidenceModalRelationship && (
        <EvidenceViewModal
          relationship={evidenceModalRelationship}
          onClose={() => setEvidenceModalRelationship(null)}
        />
      )}
    </div>
  );
}
