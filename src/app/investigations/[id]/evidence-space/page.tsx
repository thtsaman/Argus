"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { EvidenceGraph } from "@/components/graph/EvidenceGraph";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { RelationshipStatusBadge } from "@/components/ui/RelationshipStatus";
import type { GraphData } from "@/lib/graph/analysis";
import type { RelationshipStatus } from "@prisma/client";

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
  const [loading, setLoading] = useState(true);

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
      setRelatedRels(data.relationships);
    },
    [id]
  );

  const findPath = async () => {
    if (!pathSource || !pathTarget) return;
    const res = await fetch(`/api/investigations/${id}/path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: pathSource, targetId: pathTarget }),
    });
    const data = await res.json();
    if (data.paths?.[0]) {
      setHighlightedPath(data.paths[0]);
    }
  };

  const connectedNodes = selectedNode
    ? new Set([
        selectedNode,
        ...(relatedRels.flatMap((r) => [r.source.id, r.target.id])),
      ])
    : undefined;

  if (loading) return <div className="p-8"><LoadingState /></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title="Evidence Space"
        description="Explore entity relationships with progressive focus. Select entities to reveal connections and supporting evidence."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {graphData && (
            <EvidenceGraph
              data={graphData}
              selectedNodeId={selectedNode}
              highlightedPath={highlightedPath}
              highlightedNodes={connectedNodes}
              onNodeClick={loadEntityDetail}
              height={600}
            />
          )}

          <div className="mt-4 surface p-4">
            <SectionHeader title="Connection path" subtitle="Select two entities to trace their connection" />
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="text-xs text-text-muted block mb-1">Source entity</label>
                <select
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="text-sm border border-border rounded px-2 py-1.5 bg-surface-elevated min-w-[180px]"
                >
                  <option value="">Select...</option>
                  {graphData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Target entity</label>
                <select
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="text-sm border border-border rounded px-2 py-1.5 bg-surface-elevated min-w-[180px]"
                >
                  <option value="">Select...</option>
                  {graphData?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={findPath}
                className="text-sm px-4 py-1.5 bg-accent text-surface-elevated rounded hover:bg-accent-hover transition-colors"
              >
                Find path
              </button>
              {highlightedPath.length > 0 && (
                <button
                  onClick={() => setHighlightedPath([])}
                  className="text-sm px-3 py-1.5 border border-border rounded hover:border-border-strong transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-elevated p-4">
            <SectionHeader title="Legend" />
            <div className="space-y-2">
              {(["DIRECT", "VERIFIED", "UNDER_REVIEW", "AI_SUGGESTED", "REJECTED"] as RelationshipStatus[]).map(
                (s) => (
                  <RelationshipStatusBadge key={s} status={s} />
                )
              )}
            </div>
          </div>

          {entityDetail && (
            <div className="surface-elevated p-4">
              <SectionHeader title={entityDetail.label} subtitle={entityDetail.type} />
              {entityDetail.description && (
                <p className="text-sm text-text-secondary mb-3">{entityDetail.description}</p>
              )}
              {entityDetail.aliases.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-text-muted mb-1">Aliases</p>
                  <div className="flex flex-wrap gap-1">
                    {entityDetail.aliases.map((a) => (
                      <span key={a.alias} className="text-xs px-2 py-0.5 border border-border rounded">
                        {a.alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-text-muted mb-2">{relatedRels.length} relationships</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {relatedRels.map((r) => (
                  <div key={r.id} className="border border-border rounded p-2">
                    <p className="text-xs">
                      {r.source.id === entityDetail.id ? `→ ${r.target.label}` : `← ${r.source.label}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <RelationshipStatusBadge status={r.status} />
                      {r.confidence != null && (
                        <span className="text-xs text-text-muted">{Math.round(r.confidence * 100)}%</span>
                      )}
                    </div>
                    {r.evidence.length > 0 && (
                      <p className="text-xs text-text-muted mt-1">
                        Evidence: {r.evidence[0].evidence.title}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
