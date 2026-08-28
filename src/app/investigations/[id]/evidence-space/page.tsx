"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import type { GraphData } from "@/lib/graph/analysis";
import type { RelationshipStatus } from "@prisma/client";
import { motion } from "framer-motion";

interface EntityDetail {
  id: string;
  label: string;
  type: string;
  description: string | null;
  aliases: { alias: string }[];
}

interface RelationshipDetail {
  id: string;
  type: string;
  status: RelationshipStatus;
  confidence: number | null;
  source: { id: string; label: string };
  target: { id: string; label: string };
  evidence: { excerpt: string | null; evidence: { title: string } }[];
}

export default function EvidenceSpacePage() {
  const { id } = useParams<{ id: string }>();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [entityDetail, setEntityDetail] = useState<EntityDetail | null>(null);
  const [relatedRels, setRelatedRels] = useState<RelationshipDetail[]>([]);
  const [pathSource, setPathSource] = useState<string>("");
  const [pathTarget, setPathTarget] = useState<string>("");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
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
    async (nodeId: string) => {
      setSelectedNode(nodeId);
      const res = await fetch(`/api/investigations/${id}/entities/${nodeId}`);
      const data = await res.json();
      setEntityDetail(data.entity);
      setRelatedRels(data.relationships || []);
    },
    [id]
  );

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
    } else {
      setHighlightedPath([]);
    }
  };

  const filteredGraphData = useMemo(() => {
    if (!graphData) return null;
    if (typeFilter === "ALL") return graphData;

    const nodes = graphData.nodes.filter((n) => n.type === typeFilter);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = graphData.links.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    return { nodes, links };
  }, [graphData, typeFilter]);

  const pathNodeLabels = useMemo(() => {
    if (!graphData || highlightedPath.length === 0) return [];
    const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));
    return highlightedPath.map((id) => nodeMap.get(id)).filter(Boolean);
  }, [graphData, highlightedPath]);

  const connectedNodes = selectedNode
    ? new Set([
        selectedNode,
        ...(relatedRels.flatMap((r) => [r.source.id, r.target.id])),
      ])
    : undefined;

  if (loading) return <div className="p-8"><LoadingState /></div>;

  const ENTITY_TYPES = ["ALL", "PERSON", "PHONE", "ACCOUNT", "ORGANIZATION", "VEHICLE", "LOCATION"];

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Evidence Space & Graph Exploration"
        description="Explore entity relationships with progressive focus. Click nodes on the graph to inspect evidence or trace shortest paths between entities."
      />

      {/* Top Filter Bar */}
      <div className="surface-elevated p-4 rounded-lg border border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Entity Filter:</span>
          <div className="flex flex-wrap gap-1">
            {ENTITY_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${
                  typeFilter === t
                    ? "bg-accent text-surface-elevated font-semibold shadow-sm"
                    : "text-text-secondary hover:text-foreground hover:bg-background border border-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-text-muted">
          Showing {filteredGraphData?.nodes.length} nodes & {filteredGraphData?.links.length} links
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Graph Area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="h-[600px] rounded-lg overflow-hidden border border-border relative">
            {filteredGraphData && (
              <EvidenceGraph
                data={filteredGraphData}
                selectedNodeId={selectedNode}
                highlightedPath={highlightedPath}
                highlightedNodes={connectedNodes}
                onNodeClick={loadEntityDetail}
                height={600}
              />
            )}

            <div className="absolute top-3 left-3 bg-surface-elevated/90 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-xs text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span>Click any node to reveal supporting evidence</span>
            </div>
          </div>

          {/* Interactive Connection Path Tracer */}
          <div className="surface-elevated p-5 rounded-lg border border-border space-y-4">
            <SectionHeader
              title="Connection Path Tracer"
              subtitle="Select source and target entities to compute and highlight the shortest connection path"
            />
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-text-muted font-medium block mb-1">Source Entity</label>
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
                <label className="text-xs text-text-muted font-medium block mb-1">Target Entity</label>
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
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-lg bg-background border border-border space-y-2">
                <span className="text-xs text-text-muted font-medium uppercase tracking-wider block">Discovered Connection Chain ({pathNodeLabels.length} hops):</span>
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
                      {i < pathNodeLabels.length - 1 && <span className="text-accent font-bold text-sm">&rarr;</span>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Sidebar Inspector & Legend */}
        <div className="space-y-4">
          <div className="surface-elevated p-4 rounded-lg border border-border space-y-3">
            <SectionHeader title="Relationship Legend" />
            <div className="flex flex-wrap gap-2">
              {(["DIRECT", "VERIFIED", "UNDER_REVIEW", "AI_SUGGESTED", "REJECTED"] as RelationshipStatus[]).map(
                (s) => (
                  <RelationshipStatusBadge key={s} status={s} />
                )
              )}
            </div>
          </div>

          {entityDetail ? (
            <motion.div
              key={entityDetail.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-elevated p-5 rounded-lg border border-border shadow-sm space-y-4"
            >
              <div className="border-b border-border pb-3">
                <span className="text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 bg-accent/10 text-accent rounded">
                  {entityDetail.type}
                </span>
                <h3 className="font-serif text-xl font-semibold mt-1 text-foreground">{entityDetail.label}</h3>
                {entityDetail.description && (
                  <p className="text-xs text-text-secondary mt-1.5 line-clamp-3">{entityDetail.description}</p>
                )}
              </div>

              {/* Set Path Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPathSource(entityDetail.id)}
                  className="flex-1 text-xs py-1.5 px-2 rounded border border-border bg-background hover:bg-surface hover:border-accent text-text-secondary hover:text-foreground font-medium transition-colors"
                >
                  Set as Source
                </button>
                <button
                  onClick={() => setPathTarget(entityDetail.id)}
                  className="flex-1 text-xs py-1.5 px-2 rounded border border-border bg-background hover:bg-surface hover:border-accent text-text-secondary hover:text-foreground font-medium transition-colors"
                >
                  Set as Target
                </button>
              </div>

              {entityDetail.aliases.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted font-medium mb-1">Known Aliases</p>
                  <div className="flex flex-wrap gap-1">
                    {entityDetail.aliases.map((a) => (
                      <span key={a.alias} className="text-xs px-2 py-0.5 bg-background border border-border rounded text-text-secondary">
                        {a.alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-text-muted font-medium">Relationships ({relatedRels.length})</span>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {relatedRels.map((r) => {
                    const isTarget = r.source.id === entityDetail.id;
                    const connected = isTarget ? r.target : r.source;
                    return (
                      <div key={r.id} className="p-3 rounded bg-background border border-border hover:border-accent transition-colors space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <button
                            onClick={() => loadEntityDetail(connected.id)}
                            className="font-medium text-foreground hover:text-accent underline transition-colors"
                          >
                            {isTarget ? `→ ${connected.label}` : `← ${connected.label}`}
                          </button>
                          <span className="text-[10px] text-text-muted font-mono">{r.type}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <RelationshipStatusBadge status={r.status} />
                          {r.confidence != null && (
                            <span className="text-[10px] text-text-muted font-mono">{Math.round(r.confidence * 100)}% conf</span>
                          )}
                        </div>

                        {r.evidence.length > 0 && (
                          <div className="text-[11px] text-text-muted bg-surface p-1.5 rounded border border-border/50">
                            <strong>Evidence:</strong> {r.evidence[0].evidence.title}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="surface p-8 rounded-lg border border-border text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No Entity Selected</p>
              <p className="text-xs text-text-muted">Click any node on the graph or choose path entities to inspect detailed relationships and evidence.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
