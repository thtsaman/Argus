"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
import { AddToBriefButton } from "@/components/investigation/AddToBriefButton";
import { setupSpaciousGraphForces, renderGroundedNodeAndLabel } from "@/lib/graph/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ContextualChatWidget } from "@/components/investigation/ContextualChatWidget";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface FinancialEntity {
  id: string;
  identifier: string;
  label: string;
  type: "BANK_ACCOUNT" | "UPI_ID" | "EXCHANGE";
  attributionStatus: string;
  linkedEntityId?: string | null;
  linkedEntity?: { id: string; label: string; type: string } | null;
}

interface Transaction {
  id: string;
  senderFinancialEntityId: string;
  receiverFinancialEntityId: string;
  amount: string | number;
  currency: string;
  timestamp: string;
  channel: string;
  purpose?: string | null;
  incident?: string | null;
  sender: FinancialEntity;
  receiver: FinancialEntity;
  sourceEvidence?: { id: string; title: string; fileName?: string } | null;
}

interface FinancialSignal {
  id: string;
  label: string;
  description: string;
  sourceExcerpt?: string;
  data: {
    signalKey: string;
    type: string;
    priority: string;
    anchorTransaction?: string;
    anchorEntity?: string;
  };
}

export default function FinancialTrailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get("entityId");
  const entityLabelParam = searchParams.get("entityLabel");

  const [financialEntities, setFinancialEntities] = useState<FinancialEntity[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [signals, setSignals] = useState<FinancialSignal[]>([]);
  const [summary, setSummary] = useState({ totalReceived: 0, totalSent: 0, transactionCount: 0, signalCount: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & selection
  const [selectedFeId, setSelectedFeId] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [hoveredTxId, setHoveredTxId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [hoveredNodePos, setHoveredNodePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTxPos, setHoveredTxPos] = useState<{ x: number; y: number } | null>(null);

  const [selectedIncident, setSelectedIncident] = useState<string>("ALL");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [pathTxIds, setPathTxIds] = useState<Set<string>>(new Set());

  // Money movement rupee animation state
  const [animatingTxId, setAnimatingTxId] = useState<string | null>(null);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const [pulsingNodeId, setPulsingNodeId] = useState<string | null>(null);
  const [showContextualChat, setShowContextualChat] = useState(false);

  const graphRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // Fetch initial financial dataset
  useEffect(() => {
    setLoading(true);
    fetch(`/api/investigations/${id}/financial`)
      .then((r) => r.json())
      .then((data) => {
        setFinancialEntities(data.financialEntities || []);
        setTransactions(data.transactions || []);
        setSignals(data.signals || []);
        setSummary(data.summary || { totalReceived: 0, totalSent: 0, transactionCount: 0, signalCount: 0 });
        setLoading(false);

        // Auto select entity from URL param if available
        if (entityIdParam) {
          const fe = (data.financialEntities || []).find((f: FinancialEntity) => f.linkedEntityId === entityIdParam);
          if (fe) setSelectedFeId(fe.id);
        }
      })
      .catch(() => setLoading(false));
  }, [id, entityIdParam]);

  // Filter transactions based on selection and incident window
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedIncident !== "ALL" && tx.incident !== selectedIncident) return false;
      if (selectedFeId) {
        return tx.senderFinancialEntityId === selectedFeId || tx.receiverFinancialEntityId === selectedFeId;
      }
      return true;
    });
  }, [transactions, selectedIncident, selectedFeId]);

  // Transform financial entities and transactions into 2D force graph data
  const graphData = useMemo(() => {
    const nodesMap = new Map<string, any>();
    financialEntities.forEach((fe) => {
      nodesMap.set(fe.id, {
        id: fe.id,
        label: fe.identifier,
        type: fe.type,
        attributionStatus: fe.attributionStatus,
        linkedPerson: fe.linkedEntity?.label || null,
      });
    });

    const links = filteredTxs
      .filter((tx) => nodesMap.has(tx.senderFinancialEntityId) && nodesMap.has(tx.receiverFinancialEntityId))
      .map((tx) => ({
        id: tx.id,
        source: tx.senderFinancialEntityId,
        target: tx.receiverFinancialEntityId,
        amount: tx.amount,
        incident: tx.incident,
        timestamp: tx.timestamp,
        channel: tx.channel,
        senderIdentifier: tx.sender?.identifier,
        receiverIdentifier: tx.receiver?.identifier,
      }));

    return { nodes: Array.from(nodesMap.values()), links };
  }, [financialEntities, filteredTxs]);

  // Apply layout force simulation configs and fitView on load
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return;

    setupSpaciousGraphForces(graphRef.current);

    const timer = setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(400, 50);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [graphData]);

  // Trace Back / Trace Forward helper
  const handleTrace = useCallback(async (direction: "forward" | "back") => {
    if (!selectedFeId) return;

    // Direct multi-hop BFS traversal on full transaction dataset
    const visitedNodes = new Set<string>([selectedFeId]);
    const matchedTxIds = new Set<string>();

    const queue: string[] = [selectedFeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const connectedTxs = transactions.filter((tx) =>
        direction === "back"
          ? tx.receiverFinancialEntityId === currentId
          : tx.senderFinancialEntityId === currentId
      );

      for (const tx of connectedTxs) {
        matchedTxIds.add(tx.id);
        const nextId = direction === "back" ? tx.senderFinancialEntityId : tx.receiverFinancialEntityId;
        if (!visitedNodes.has(nextId)) {
          visitedNodes.add(nextId);
          queue.push(nextId);
        }
      }
    }

    if (matchedTxIds.size > 0) {
      setPathTxIds(matchedTxIds);
      setHighlightedPath(Array.from(visitedNodes));
      const firstTx = transactions.find((t) => matchedTxIds.has(t.id));
      if (firstTx) setSelectedTx(firstTx);
    }
  }, [selectedFeId, transactions]);

  // State to track current transaction during animation for header date sync
  const [activeAnimTx, setActiveAnimTx] = useState<Transaction | null>(null);

  // Follow Money - Precise Rupee Animation along transaction edges
  const handleFollowMoney = useCallback(async () => {
    const txList = pathTxIds.size > 0 
      ? transactions.filter((t) => pathTxIds.has(t.id))
      : filteredTxs;

    if (txList.length === 0) return;

    for (const tx of txList) {
      setAnimatingTxId(tx.id);
      setSelectedTx(tx);
      setActiveAnimTx(tx);
      setAnimProgress(0);

      const duration = 1500; // ms for single hop travel
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const animateStep = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          setAnimProgress(progress);

          if (progress < 1) {
            animFrameRef.current = requestAnimationFrame(animateStep);
          } else {
            setPulsingNodeId(tx.receiverFinancialEntityId);
            setTimeout(() => {
              setPulsingNodeId(null);
              resolve();
            }, 400);
          }
        };
        animFrameRef.current = requestAnimationFrame(animateStep);
      });
    }
    setAnimatingTxId(null);
    setActiveAnimTx(null);
    setAnimProgress(0);
  }, [pathTxIds, transactions, filteredTxs]);

  const selectedFe = useMemo(
    () => financialEntities.find((f) => f.id === selectedFeId),
    [financialEntities, selectedFeId]
  );

  // Active Date Header context derived from active animation tx, selected transaction, or first filtered tx
  const activeHeaderContext = useMemo(() => {
    const activeTx = activeAnimTx || selectedTx || (animatingTxId ? transactions.find((t) => t.id === animatingTxId) : filteredTxs[0]);
    if (activeTx) {
      const dateStr = new Date(activeTx.timestamp).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `${dateStr} · ${activeTx.incident || "EX-04"} · Active Financial Activity`;
    }
    return "17 Aug 2026 · EX-04 · Active Financial Activity";
  }, [activeAnimTx, selectedTx, animatingTxId, transactions, filteredTxs]);

  if (loading) return <div className="p-8"><LoadingState message="Loading Financial Trail..." /></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="Financial Trail & Money Flow Investigation"
        description="Trace synthetic bank and UPI money movements, identify candidate intermediary accounts, and link financial activity to incident windows."
        actions={
          <div className="flex items-center gap-2">
            <AddToBriefButton
              itemType="FINANCIAL"
              itemData={{
                id: selectedTx?.id || "FIN-TRAIL",
                title: selectedFe ? `Synthetic Money Trail (${selectedFe.identifier})` : "Synthetic Bank / UPI Money Trail",
                amount: selectedTx?.amount || 450000,
                channel: selectedTx?.channel || "BANK_TRANSFER / UPI",
                date: selectedTx ? new Date(selectedTx.timestamp).toISOString() : new Date().toISOString(),
                source: selectedTx?.sender?.identifier || "Bank Account ****9012",
                target: selectedTx?.receiver?.identifier || "UPI synthetic.dist@upi",
                details: "High-velocity financial layering detected across synthetic accounts.",
              }}
              label="Add Financial Finding to Brief"
              className="px-3.5 py-1.5 bg-amber-700/10 hover:bg-amber-700/20 text-amber-800 border border-amber-700/30 font-semibold rounded text-xs font-mono transition-colors"
            />
            {selectedFeId && (
              <button
                onClick={() => {
                  setSelectedFeId(null);
                  setSelectedTx(null);
                  setHighlightedPath([]);
                  setPathTxIds(new Set());
                }}
                className="text-xs px-3 py-1.5 rounded border border-border bg-surface hover:bg-background text-text-secondary font-medium transition-colors"
              >
                Clear Selection
              </button>
            )}
            <button
              onClick={() => handleTrace("back")}
              disabled={!selectedFeId}
              className="text-xs px-3 py-1.5 rounded border border-border bg-surface-elevated hover:bg-surface text-foreground font-semibold shadow-xs disabled:opacity-40 disabled:hover:bg-surface-elevated transition-colors flex items-center gap-1"
            >
              <span>←</span> Trace Back
            </button>
            <button
              onClick={() => handleTrace("forward")}
              disabled={!selectedFeId}
              className="text-xs px-3 py-1.5 rounded border border-border bg-surface-elevated hover:bg-surface text-foreground font-semibold shadow-xs disabled:opacity-40 disabled:hover:bg-surface-elevated transition-colors flex items-center gap-1"
            >
              Trace Forward <span>→</span>
            </button>
            <button
              onClick={handleFollowMoney}
              className="text-xs px-3.5 py-1.5 rounded bg-emerald-700 text-white font-semibold shadow-xs hover:bg-emerald-800 transition-colors flex items-center gap-1.5"
            >
              <span className="font-bold">₹</span> Follow Money
            </button>
            <button
              onClick={() => setShowContextualChat((prev) => !prev)}
              className="text-xs px-3 py-1.5 rounded border border-accent/40 bg-accent/10 text-accent font-semibold hover:bg-accent/20 transition-colors"
            >
              ✨ Ask Vyom AI
            </button>
          </div>
        }
      />

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="surface p-3.5 rounded border border-border">
          <span className="text-[11px] text-text-muted uppercase tracking-wider block">Total Received</span>
          <span className="text-lg font-mono font-bold text-emerald-400">₹{(summary.totalReceived / 100000).toFixed(2)}L</span>
        </div>
        <div className="surface p-3.5 rounded border border-border">
          <span className="text-[11px] text-text-muted uppercase tracking-wider block">Total Sent</span>
          <span className="text-lg font-mono font-bold text-foreground">₹{(summary.totalSent / 100000).toFixed(2)}L</span>
        </div>
        <div className="surface p-3.5 rounded border border-border">
          <span className="text-[11px] text-text-muted uppercase tracking-wider block">Transactions</span>
          <span className="text-lg font-mono font-bold text-foreground">{summary.transactionCount}</span>
        </div>
        <div className="surface p-3.5 rounded border border-border">
          <span className="text-[11px] text-text-muted uppercase tracking-wider block">Financial Signals</span>
          <span className="text-lg font-mono font-bold text-amber-400">{summary.signalCount}</span>
        </div>
        <div className="surface p-3.5 rounded border border-border">
          <span className="text-[11px] text-text-muted uppercase tracking-wider block">Incidents Tracked</span>
          <span className="text-lg font-mono font-bold text-accent">EX-01 — EX-04</span>
        </div>
      </div>

      {/* Incident Window Selector */}
      <div className="surface p-3 rounded border border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">Incident Window:</span>
          {["ALL", "EX-01", "EX-02", "EX-03", "EX-04"].map((inc) => (
            <button
              key={inc}
              onClick={() => setSelectedIncident(inc)}
              className={`px-3 py-1 text-xs rounded transition-all font-medium ${
                selectedIncident === inc
                  ? "bg-accent text-surface-elevated font-semibold shadow-sm"
                  : "text-text-secondary hover:text-foreground hover:bg-background border border-border"
              }`}
            >
              {inc}
            </button>
          ))}
        </div>
        {selectedFe && (
          <div className="text-xs font-mono text-emerald-400 flex items-center gap-2">
            <span>Selected Node: {selectedFe.identifier}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-background border border-border text-text-muted">
              {selectedFe.attributionStatus === "OWNER_UNVERIFIED" ? "OWNER UNVERIFIED" : selectedFe.attributionStatus}
            </span>
          </div>
        )}
      </div>

      {/* Main Workspace: Central Graph + Activity Notebook */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Central Financial Graph (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[620px] rounded-lg overflow-hidden border border-border relative bg-surface shadow-xs">
            {/* Top Date Header Strip inside Graph Panel */}
            <div className="absolute top-3 left-4 z-20 px-3 py-1.5 rounded bg-surface-elevated/90 border border-border/80 text-xs font-mono text-foreground font-semibold shadow-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeHeaderContext}
            </div>

            {/* Hover Tooltip for Nodes & Edges */}
            {hoveredNode && hoveredNodePos && (
              <div
                style={{ left: hoveredNodePos.x + 12, top: hoveredNodePos.y + 12 }}
                className="absolute z-30 pointer-events-none p-2.5 bg-surface-elevated border border-border rounded shadow-md text-xs font-mono space-y-1"
              >
                <div className="font-bold text-foreground">{hoveredNode.label}</div>
                <div className="text-[11px] text-text-secondary">Type: {hoveredNode.type}</div>
                <div className="text-[10px] text-text-muted">{hoveredNode.attributionStatus}</div>
              </div>
            )}

            {hoveredTxPos && hoveredTxId && (
              <div
                style={{ left: hoveredTxPos.x + 12, top: hoveredTxPos.y + 12 }}
                className="absolute z-30 pointer-events-none p-2.5 bg-surface-elevated border border-border rounded shadow-md text-xs font-mono space-y-1"
              >
                {(() => {
                  const tx = transactions.find((t) => t.id === hoveredTxId);
                  if (!tx) return null;
                  return (
                    <>
                      <div className="font-bold text-emerald-400">₹{(Number(tx.amount) / 100000).toFixed(2)} Lakh</div>
                      <div className="text-[11px] text-foreground">{tx.sender?.identifier} → {tx.receiver?.identifier}</div>
                      <div className="text-[10px] text-text-muted">{new Date(tx.timestamp).toLocaleDateString("en-IN")} · {tx.channel}</div>
                    </>
                  );
                })()}
              </div>
            )}

            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeId="id"
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const isSelected = node.id === selectedFeId;
                const isPulsing = node.id === pulsingNodeId;
                const inPath = highlightedPath.includes(node.id);

                const hasFocus = selectedFeId || selectedTx || highlightedPath.length > 0;
                const isRelevant = !hasFocus || isSelected || inPath || (selectedTx && (selectedTx.senderFinancialEntityId === node.id || selectedTx.receiverFinancialEntityId === node.id));
                const opacity = isRelevant ? 1.0 : 0.25;

                const isBankOrUpi = node.type === "BANK_ACCOUNT" || node.type === "UPI_ID";
                const isExchange = node.type === "EXCHANGE";
                const nodeColor = isSelected ? "#10b981" : inPath ? "#34d399" : isBankOrUpi ? "#4a6741" : "#8b6914";

                renderGroundedNodeAndLabel(node, ctx, globalScale, {
                  isSelected: isSelected || isPulsing,
                  inPath,
                  isBridge: false,
                  isBankOrUpi,
                  isExchange,
                  nodeColor,
                  opacity,
                });
              }}
              linkCanvasObjectMode={() => "after"}
              linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const isSelected = selectedTx?.id === link.id;
                const isPath = pathTxIds.has(link.id);
                const isAnimating = animatingTxId === link.id;

                const start = link.source;
                const end = link.target;
                if (!start || !end || typeof start.x !== "number" || typeof end.x !== "number") return;

                // Draw edge amount label when selected or animating
                if (isSelected || isAnimating || isPath) {
                  const fontSize = Math.max(10 / globalScale, 3);
                  ctx.font = `600 ${fontSize}px monospace`;
                  ctx.fillStyle = "#2c2416";
                  ctx.textAlign = "center";
                  const midX = (start.x + end.x) / 2;
                  const midY = (start.y + end.y) / 2;
                  const amtLabel = `₹${(Number(link.amount) / 100000).toFixed(2)}L`;
                  ctx.fillText(amtLabel, midX, midY - 6);
                }

                // Precision Rupee Movement Animation traveling along exact path geometry
                if (isAnimating && animProgress > 0) {
                  const currentX = start.x + (end.x - start.x) * animProgress;
                  const currentY = start.y + (end.y - start.y) * animProgress;

                  // Draw traveling rupee badge marker
                  const rSize = 10 / globalScale;
                  ctx.beginPath();
                  ctx.arc(currentX, currentY, rSize, 0, 2 * Math.PI);
                  ctx.fillStyle = "#10b981";
                  ctx.fill();

                  ctx.strokeStyle = "#ffffff";
                  ctx.lineWidth = 1.5 / globalScale;
                  ctx.stroke();

                  ctx.font = `bold ${Math.max(9 / globalScale, 3)}px sans-serif`;
                  ctx.fillStyle = "#ffffff";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText("₹", currentX, currentY);
                }
              }}
              linkDirectionalArrowLength={6}
              linkDirectionalArrowRelPos={0.95}
              linkWidth={(link: any) => (selectedTx?.id === link.id || pathTxIds.has(link.id) || link.id === animatingTxId ? 2.5 : 1)}
              linkColor={(link: any) => {
                if (selectedTx?.id === link.id || link.id === animatingTxId) return "#10b981";
                if (pathTxIds.has(link.id)) return "#2c2416";
                return "rgba(44, 36, 22, 0.25)";
              }}
              onNodeClick={(node: any) => {
                if (selectedFeId === node.id) {
                  setSelectedFeId(null);
                } else {
                  setSelectedFeId(node.id);
                }
              }}
              onNodeHover={(node: any) => {
                setHoveredNode(node);
                if (node && graphRef.current && typeof graphRef.current.graph2Coords === "function") {
                  const coords = graphRef.current.graph2Coords(node.x, node.y);
                  setHoveredNodePos(coords);
                } else {
                  setHoveredNodePos(null);
                }
              }}
              onLinkClick={(link: any) => {
                const foundTx = transactions.find((t) => t.id === link.id);
                if (foundTx) setSelectedTx(foundTx);
              }}
              onLinkHover={(link: any) => {
                if (link && graphRef.current && typeof graphRef.current.graph2Coords === "function") {
                  setHoveredTxId(link.id);
                  const start = link.source;
                  const end = link.target;
                  if (start && end && typeof start.x === "number" && typeof end.x === "number") {
                    const coords = graphRef.current.graph2Coords((start.x + end.x) / 2, (start.y + end.y) / 2);
                    setHoveredTxPos(coords);
                  }
                } else {
                  setHoveredTxId(null);
                  setHoveredTxPos(null);
                }
              }}
              onBackgroundClick={() => {
                setSelectedFeId(null);
                setSelectedTx(null);
                setHighlightedPath([]);
                setPathTxIds(new Set());
              }}
              height={620}
            />
          </div>

          {/* Signals & Layering Analysis Strip */}
          <div className="surface p-4 rounded border border-border space-y-3">
            <SectionHeader title="Financial Signals & Layering Analysis" subtitle="Surfaced investigative signals from synthetic banking ledger" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {signals.map((sig) => (
                <div key={sig.id} className="p-3 bg-background rounded border border-border space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground">{sig.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      {sig.data.priority}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-snug">{sig.description}</p>
                  {sig.sourceExcerpt && (
                    <p className="text-[10px] font-mono text-text-muted italic border-l-2 border-border pl-2">
                      Notice: {sig.sourceExcerpt}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right-Side Transaction Activity Notebook */}
        <div className="space-y-4">
          <div className="surface p-4 rounded border border-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-md font-medium text-foreground">Transaction Activity Notebook</h3>
              <span className="text-xs font-mono text-text-muted">{filteredTxs.length} Record(s)</span>
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredTxs.map((tx) => {
                const isSelected = selectedTx?.id === tx.id;
                const isAnimating = animatingTxId === tx.id;
                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      if (selectedTx?.id === tx.id) {
                        setSelectedTx(null);
                      } else {
                        setSelectedTx(tx);
                        setSelectedFeId(tx.senderFinancialEntityId);
                      }
                    }}
                    className={`p-3 rounded border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-surface-elevated border-accent shadow-xs"
                        : isAnimating
                        ? "bg-emerald-500/10 border-emerald-500"
                        : "bg-background hover:bg-surface border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-foreground">
                        ₹{(Number(tx.amount) / 100000).toFixed(2)}L
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                        {tx.incident || "EX-01"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-text-secondary">
                      <span>{tx.sender?.identifier || "ACC-UNKNOWN"}</span>
                      <span className="text-text-muted">→</span>
                      <span>{tx.receiver?.identifier || "ACC-UNKNOWN"}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>{new Date(tx.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      <span className="font-mono text-accent">{tx.channel}</span>
                    </div>

                    {tx.purpose && (
                      <p className="text-[11px] text-text-secondary italic font-sans">{tx.purpose}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Transaction Detail Drawer */}
          {selectedTx && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="surface p-4 rounded border border-border space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-accent font-mono font-semibold uppercase tracking-wider block">
                      Transaction Detail
                    </span>
                    <h4 className="text-lg font-mono font-bold text-foreground">
                      ₹{(Number(selectedTx.amount) / 100000).toFixed(2)} Lakh
                    </h4>
                  </div>
                  <button onClick={() => setSelectedTx(null)} className="text-xs text-text-muted hover:text-foreground">
                    ✕
                  </button>
                </div>

                <div className="space-y-1.5 text-xs font-mono text-text-secondary border-t border-border pt-2">
                  <div>Sender: {selectedTx.sender?.identifier}</div>
                  <div>Receiver: {selectedTx.receiver?.identifier}</div>
                  <div>Channel: {selectedTx.channel}</div>
                  <div>Date: {new Date(selectedTx.timestamp).toLocaleString("en-IN")}</div>
                  <div>Incident Window: {selectedTx.incident}</div>
                  {selectedTx.sourceEvidence && (
                    <div className="text-accent font-sans mt-1">
                      Evidence Source: {selectedTx.sourceEvidence.title}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-background rounded border border-border text-[11px] space-y-1 text-text-secondary font-sans">
                  <span className="font-semibold text-foreground block">Why this transaction matters:</span>
                  <p>
                    This transfer occurs during the {selectedTx.incident} logistics timeframe and forms part of the candidate money movement trail requiring investigator review.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Contextual Ask ARGUS Floating Widget */}
      {showContextualChat && (
        <ContextualChatWidget
          investigationId={id}
          contextType="FINANCIAL"
          contextId={selectedFeId || id}
          contextLabel={selectedFe?.identifier || "Financial Trail"}
          onClose={() => setShowContextualChat(false)}
        />
      )}
    </div>
  );
}
