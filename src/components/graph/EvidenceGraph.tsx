"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { GraphData } from "@/lib/graph/analysis";
import { getLinkStyle } from "@/components/ui/RelationshipStatus";
import type { RelationshipStatus } from "@prisma/client";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface EvidenceGraphProps {
  data: GraphData;
  selectedNodeId?: string | null;
  highlightedPath?: string[];
  highlightedNodes?: Set<string>;
  onNodeClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  width?: number;
  height?: number;
}

const NODE_COLORS: Record<string, string> = {
  PERSON: "#6b5344",
  PHONE: "#3d5a6b",
  ACCOUNT: "#4a6741",
  ORGANIZATION: "#7a5c8a",
  DEVICE: "#8a7d6b",
  VEHICLE: "#5c4f3d",
  LOCATION: "#8b6914",
  INCIDENT: "#8b4444",
};

export function EvidenceGraph({
  data,
  selectedNodeId,
  highlightedPath = [],
  highlightedNodes,
  onNodeClick,
  onBackgroundClick,
  width = 800,
  height = 600,
}: EvidenceGraphProps) {
  const [dims, setDims] = useState({ width, height });
  const containerRef = useRef<HTMLDivElement>(null);

  const graphData = useMemo(() => {
    const nodes = (data?.nodes || []).map((n) => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));

    const links = (data?.links || [])
      .filter((l) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sourceId = typeof l.source === "object" ? (l.source as any).id : l.source;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetId = typeof l.target === "object" ? (l.target as any).id : l.target;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map((l) => ({
        ...l,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source: typeof l.source === "object" ? (l.source as any).id : l.source,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        target: typeof l.target === "object" ? (l.target as any).id : l.target,
      }));

    return { nodes, links };
  }, [data]);

  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (!selectedNodeId || !fgRef.current) return;
    const node = graphData.nodes.find((n) => n.id === selectedNodeId) as any;
    if (node && typeof node.x === "number" && typeof node.y === "number") {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.5, 800);
    }
  }, [selectedNodeId, graphData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          setDims({ width: w, height: h });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pathSet = new Set(highlightedPath);
  const pathLinks = new Set<string>();
  for (let i = 0; i < highlightedPath.length - 1; i++) {
    const a = highlightedPath[i];
    const b = highlightedPath[i + 1];
    graphData.links.forEach((l) => {
      const sourceId = typeof l.source === "object" ? (l.source as any).id : l.source;
      const targetId = typeof l.target === "object" ? (l.target as any).id : l.target;
      if ((sourceId === a && targetId === b) || (sourceId === b && targetId === a)) {
        pathLinks.add(l.id);
      }
    });
  }

  const nodeCanvasObject = useCallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label as string;
      const isSelected = node.id === selectedNodeId;
      const inPath = pathSet.has(node.id as string);
      const isHighlighted = highlightedNodes?.has(node.id as string);
      const isBridge = node.isBridge;

      const hasFocus = selectedNodeId || highlightedPath.length > 0 || highlightedNodes;
      // Surrounding cluster nodes should remain fully visible (opacity 1) unless explicit path highlighting is active
      const isRelevant = !hasFocus || isSelected || inPath || isHighlighted || true;
      const opacity = (highlightedPath.length > 0 && !inPath) ? 0.35 : 1;

      const fontSize = Math.max(10 / globalScale, 3);
      ctx.globalAlpha = opacity;

      // Visual Hierarchy: Bridge (2-2.5x normal size: ~11-12px), Direct neighbors / selected (7-8px), Normal nodes (5px)
      const radius = isBridge ? 12 : (isSelected || inPath) ? 8 : 5;
      const isBankOrUpi = node.type === "BANK_ACCOUNT" || node.type === "UPI_ID";
      const isExchange = node.type === "EXCHANGE";

      if (isBankOrUpi) {
        // Draw diamond shape for financial bank/UPI nodes
        const dSize = radius * 1.2;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y - dSize);
        ctx.lineTo(node.x + dSize, node.y);
        ctx.lineTo(node.x, node.y + dSize);
        ctx.lineTo(node.x - dSize, node.y);
        ctx.closePath();
        ctx.fillStyle = node.type === "BANK_ACCOUNT" ? "#10b981" : "#06b6d4";
        ctx.fill();
      } else if (isExchange) {
        // Draw terminal hexagon shape for Exchange endpoints
        const hSize = radius * 1.3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = node.x + hSize * Math.cos(angle);
          const y = node.y + hSize * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isBridge ? "#d97706" : (NODE_COLORS[node.type as string] || "#6b5344");
        ctx.fill();
      }

      // Draw prominent outline for Bridge node & selected / path nodes
      if (isBridge) {
        ctx.strokeStyle = "#b45309";
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();

        // Extra outer glow ring for Bridge
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(217, 119, 6, 0.4)";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      } else if (isSelected || inPath) {
        ctx.strokeStyle = "#2c2416";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      ctx.font = `${isBridge ? "bold " : ""}${isBridge ? fontSize * 1.15 : fontSize}px Source Sans 3, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = isBridge ? "#92400e" : "#2c2416";
      ctx.fillText(label, node.x, node.y + radius + 3);

      ctx.globalAlpha = 1;
    },
    [selectedNodeId, highlightedPath, highlightedNodes, pathSet]
  );

  const linkColor = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any) => {
      const status = link.status as RelationshipStatus;
      const style = getLinkStyle(status);
      const inPath = pathLinks.has(link.id as string);
      const isPathActive = highlightedPath.length > 0;
      if (isPathActive && !inPath) return `rgba(44, 36, 22, 0.15)`;
      return inPath ? "#2c2416" : style.color;
    },
    [highlightedPath, pathLinks]
  );

  const linkWidth = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any) => (pathLinks.has(link.id as string) ? 2.5 : 1),
    [pathLinks]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkLineDash = useCallback((link: any) => {
    const status = link.status as RelationshipStatus;
    const style = getLinkStyle(status);
    return style.dashArray ? style.dashArray.split(",").map(Number) : null;
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] surface overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dims.width}
        height={dims.height}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node, color, ctx) => {
          const radius = 10;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkLineDash={linkLineDash}
        onNodeClick={(node) => onNodeClick?.(node.id as string)}
        onBackgroundClick={onBackgroundClick}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
