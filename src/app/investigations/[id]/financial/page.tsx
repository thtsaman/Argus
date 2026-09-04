"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";
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
  const [selectedIncident, setSelectedIncident] = useState<string>("ALL");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [pathTxIds, setPathTxIds] = useState<Set<string>>(new Set());

  // Money movement rupee animation state
  const [animatingTxId, setAnimatingTxId] = useState<string | null>(null);
  const [rupeePosition, setRupeePosition] = useState<{ x: number; y: number } | null>(null);
  const [pulsingNodeId, setPulsingNodeId] = useState<string | null>(null);
  const [showContextualChat, setShowContextualChat] = useState(false);

  const graphRef = useRef<any>(null);

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
      }));

    return { nodes: Array.from(nodesMap.values()), links };
  }, [financialEntities, filteredTxs]);

  // Trace Back / Trace Forward helper
  const handleTrace = async (direction: "forward" | "back") => {
    if (!selectedFeId) return;
    const res = await fetch(`/api/investigations/${id}/financial/trace?nodeKey=${selectedFeId}&direction=${direction}`);
    const data = await res.json();
    if (data.edges) {
      const edgeIds = new Set<string>(data.edges.map((e: any) => e.id));
      setPathTxIds(edgeIds);
      const nodeIds = new Set<string>(data.nodes.map((n: any) => n.id));
      setHighlightedPath(Array.from(nodeIds));
    }
  };

  // Find Path between selected accounts
  const handleFindPath = async (fromId: string, toId: string) => {
    const res = await fetch(`/api/investigations/${id}/financial/trace?from=${fromId}&to=${toId}`);
    const data = await res.json();
    if (data.edges) {
      const edgeIds = new Set<string>(data.edges.map((e: any) => e.id));
      setPathTxIds(edgeIds);
      const nodeIds = new Set<string>(data.nodes.map((n: any) => n.id));
      setHighlightedPath(Array.from(nodeIds));
    }
  };

  // Follow Money - Rupee Animation along transaction edges
  const handleFollowMoney = useCallback(async () => {
    const txList = pathTxIds.size > 0 
      ? transactions.filter((t) => pathTxIds.has(t.id))
      : filteredTxs.slice(0, 5);

    if (txList.length === 0) return;

    for (const tx of txList) {
      setAnimatingTxId(tx.id);
      setSelectedTx(tx);
      setPulsingNodeId(tx.receiverFinancialEntityId);

      // Animate step delay
      await new Promise((r) => setTimeout(r, 1200));
      setPulsingNodeId(null);
    }
    setAnimatingTxId(null);
  }, [pathTxIds, transactions, filteredTxs]);

  const selectedFe = useMemo(
    () => financialEntities.find((f) => f.id === selectedFeId),
    [financialEntities, selectedFeId]
  );

  if (loading) return <div className="p-8"><LoadingState message="Loading Financial Trail..." /></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="Financial Trail & Money Flow Investigation"
        description="Trace synthetic bank and UPI money movements, identify candidate intermediary accounts, and link financial activity to incident windows."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTrace("back")}
              disabled={!selectedFeId}
              className="text-xs px-3 py-1.5 rounded border border-border bg-surface hover:bg-background disabled:opacity-40 text-foreground font-medium transition-colors"
            >
              ← Trace Back
            </button>
            <button
              onClick={() => handleTrace("forward")}
              disabled={!selectedFeId}
              className="text-xs px-3 py-1.5 rounded border border-border bg-surface hover:bg-background disabled:opacity-40 text-foreground font-medium transition-colors"
            >
              Trace Forward →
            </button>
            <button
              onClick={handleFollowMoney}
              className="text-xs px-3.5 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold hover:bg-emerald-500/30 transition-colors flex items-center gap-1.5"
            >
              <span>₹</span> Follow Money
            </button>
            <button
              onClick={() => setShowContextualChat((prev) => !prev)}
              className="text-xs px-3 py-1.5 rounded bg-accent/20 border border-accent/40 text-accent font-semibold hover:bg-accent/30 transition-colors"
            >
              ✨ Ask ARGUS
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
          <div className="h-[600px] rounded-lg overflow-hidden border border-border relative surface">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeId="id"
              nodeLabel={(n: any) => `${n.label} (${n.attributionStatus})`}
              nodeCanvasObject={(node: any, ctx: any, globalScale: number) => {
                const isSelected = node.id === selectedFeId;
                const isPulsing = node.id === pulsingNodeId;
                const inPath = highlightedPath.includes(node.id);

                const size = isSelected ? 8 : 6;
                ctx.globalAlpha = 1;

                if (node.type === "BANK_ACCOUNT" || node.type === "UPI_ID") {
                  // Diamond shape
                  ctx.beginPath();
                  ctx.moveTo(node.x, node.y - size * 1.3);
                  ctx.lineTo(node.x + size * 1.3, node.y);
                  ctx.lineTo(node.x, node.y + size * 1.3);
                  ctx.lineTo(node.x - size * 1.3, node.y);
                  ctx.closePath();
                  ctx.fillStyle = isSelected ? "#10b981" : inPath ? "#34d399" : "#059669";
                  ctx.fill();
                } else {
                  // Hexagon for Exchange endpoint
                  ctx.beginPath();
                  for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    ctx.lineTo(node.x + size * 1.4 * Math.cos(angle), node.y + size * 1.4 * Math.sin(angle));
                  }
                  ctx.closePath();
                  ctx.fillStyle = "#f59e0b";
                  ctx.fill();
                }

                if (isSelected || isPulsing) {
                  ctx.strokeStyle = isPulsing ? "#10b981" : "#ffffff";
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }

                const fontSize = Math.max(10 / globalScale, 3);
                ctx.font = `${fontSize}px monospace`;
                ctx.textAlign = "center";
                ctx.fillStyle = "#e2e8f0";
                ctx.fillText(node.label, node.x, node.y + size + 4);
              }}
              linkDirectionalArrowLength={5}
              linkDirectionalArrowRelPos={0.9}
              linkDirectionalParticles={(link: any) => (link.id === animatingTxId ? 4 : 0)}
              linkDirectionalParticleSpeed={0.015}
              linkWidth={(link: any) => (pathTxIds.has(link.id) || link.id === animatingTxId ? 3 : 1)}
              linkColor={(link: any) => (pathTxIds.has(link.id) || link.id === animatingTxId ? "#10b981" : "rgba(226, 232, 240, 0.2)")}
              onNodeClick={(node: any) => setSelectedFeId(node.id)}
              onBackgroundClick={() => {
                setSelectedFeId(null);
                setHighlightedPath([]);
                setPathTxIds(new Set());
              }}
              height={600}
            />

            {/* Rupee Marker Travelling Overlay Animation */}
            {animatingTxId && (
              <div className="absolute top-4 left-4 p-2 bg-emerald-950/80 border border-emerald-500/50 rounded text-emerald-300 text-xs font-mono flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                ₹ Travelling along transaction edge...
              </div>
            )}
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
                    onClick={() => setSelectedTx(tx)}
                    className={`p-3 rounded border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-emerald-950/20 border-emerald-500/60 shadow-sm"
                        : isAnimating
                        ? "bg-emerald-950/40 border-emerald-400"
                        : "bg-background hover:bg-surface border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-emerald-400">
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
                className="surface p-4 rounded border border-emerald-500/40 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold uppercase tracking-wider block">
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
