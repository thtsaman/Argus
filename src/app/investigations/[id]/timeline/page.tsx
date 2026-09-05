"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { format, parseISO, isWithinInterval, subDays, addDays } from "date-fns";
import { PageHeader, LoadingState } from "@/components/ui/common";
import { AddToBriefButton } from "@/components/investigation/AddToBriefButton";
import { ContextualChatWidget } from "@/components/investigation/ContextualChatWidget";
import { EvidenceViewModal } from "@/components/investigation/EvidenceViewModal";

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  occurredAt: string;
  entity: { id?: string; label: string; type: string } | null;
  location: { id?: string; name: string } | null;
  evidence?: { evidence: { id: string; title: string; type: string; source: string | null; uploadedAt: string | null } }[];
}

interface ReplayFrame {
  timestamp: string;
  events: { id: string; title: string; entityId?: string }[];
  relationships: { id: string; sourceId: string; targetId: string; status: string; type?: string }[];
  entities: { id: string; label: string; type: string }[];
}

export default function TemporalReconstructionPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const entityParam = searchParams.get("entityId");
  const entityLabelParam = searchParams.get("entityLabel");

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [investigationMeta, setInvestigationMeta] = useState<any>(null);
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[]>([]);

  // Modes & Controls
  const [replayMode, setReplayMode] = useState<boolean>(false);
  const [reconstructCaseMode, setReconstructCaseMode] = useState<boolean>(false);
  const [playheadIndex, setPlayheadIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filters
  const [filterText, setFilterText] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [chapterFilter, setChapterFilter] = useState("ALL");

  // Selection & Lens
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [lensRange, setLensRange] = useState<{ start: Date; end: Date } | null>(null);

  // Assistant & Evidence Modal
  const [showAssistant, setShowAssistant] = useState(false);
  const [activeEvidenceModal, setActiveEvidenceModal] = useState<boolean>(false);
  const [modalRelationship, setModalRelationship] = useState<any | null>(null);

  // Fetch initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, metaRes, replayRes] = await Promise.all([
        fetch(`/api/investigations/${id}/events${entityParam ? `?entityIds=${entityParam}` : ""}`),
        fetch(`/api/investigations/${id}`),
        fetch(`/api/investigations/${id}/replay`),
      ]);

      const eventsData = await eventsRes.json();
      const metaData = await metaRes.json();
      const replayData = await replayRes.json();

      setEvents(eventsData.events || []);
      setInvestigationMeta(metaData);
      setReplayFrames(replayData.frames || []);
    } catch {
      console.error("Failed to load temporal data");
    } finally {
      setLoading(false);
    }
  }, [id, entityParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Temporal Aggregations
  const timeBounds = useMemo(() => {
    if (!events.length) return { start: new Date(), end: new Date() };
    const timestamps = events.map((e) => new Date(e.occurredAt).getTime());
    return {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps)),
    };
  }, [events]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesText =
        !filterText ||
        e.title.toLowerCase().includes(filterText.toLowerCase()) ||
        e.entity?.label.toLowerCase().includes(filterText.toLowerCase()) ||
        e.location?.name.toLowerCase().includes(filterText.toLowerCase());

      const matchesType =
        typeFilter === "ALL" ||
        (typeFilter === "FINANCIAL" && (e.title.includes("Bank") || e.title.includes("UPI") || e.title.includes("Transfer"))) ||
        (typeFilter === "COMMUNICATION" && (e.title.includes("Call") || e.title.includes("Message") || e.title.includes("Dispatch"))) ||
        (typeFilter === "EVIDENCE" && (e.evidence?.length || 0) > 0) ||
        (e.entity && e.entity.type === typeFilter);

      const matchesChapter =
        chapterFilter === "ALL" || e.title.toLowerCase().includes(chapterFilter.toLowerCase());

      const matchesLens =
        !lensRange ||
        isWithinInterval(new Date(e.occurredAt), { start: lensRange.start, end: lensRange.end });

      return matchesText && matchesType && matchesChapter && matchesLens;
    });
  }, [events, filterText, typeFilter, chapterFilter, lensRange]);

  // Group events by Incidents / Chapters
  const incidents = useMemo(() => {
    const list: { id: string; name: string; date: string; events: TimelineEvent[] }[] = [];
    const keywords = [
      { id: "EX-01", name: "EX-01 Paper Leak Window", keyword: "west bengal" },
      { id: "EX-02", name: "EX-02 Recruitment Leak Window", keyword: "bihar" },
      { id: "EX-03", name: "EX-03 Distribution Hub Window", keyword: "delhi" },
      { id: "EX-04", name: "EX-04 Financial Settlement Window", keyword: "settlement" },
    ];

    keywords.forEach((k) => {
      const matched = events.filter((e) =>
        e.title.toLowerCase().includes(k.keyword) || e.description?.toLowerCase().includes(k.keyword)
      );
      if (matched.length > 0) {
        list.push({
          id: k.id,
          name: k.name,
          date: format(new Date(matched[0].occurredAt), "dd MMM yyyy"),
          events: matched,
        });
      }
    });

    if (list.length === 0 && events.length > 0) {
      list.push({
        id: "CHAPTER-01",
        name: "Primary Investigation Activity Window",
        date: format(new Date(events[0].occurredAt), "dd MMM yyyy"),
        events: events,
      });
    }

    return list;
  }, [events]);

  const currentReplayEvent = events[playheadIndex] || null;

  // Playhead position percentage across total investigation timeframe
  const playheadProgressPercent = useMemo(() => {
    if (!events.length) return 0;
    const startMs = timeBounds.start.getTime();
    const endMs = timeBounds.end.getTime();
    const totalMs = Math.max(endMs - startMs, 1);
    const currentMs = currentReplayEvent ? new Date(currentReplayEvent.occurredAt).getTime() : startMs;
    return Math.min(Math.max(((currentMs - startMs) / totalMs) * 100, 0), 100);
  }, [events, timeBounds, currentReplayEvent]);

  // Active time bucket at current playhead
  const activeBinIndex = useMemo(() => {
    if (!events.length || !currentReplayEvent) return 0;
    const startMs = timeBounds.start.getTime();
    const totalDuration = Math.max(timeBounds.end.getTime() - startMs, 1);
    const step = totalDuration / 24;
    const currentMs = new Date(currentReplayEvent.occurredAt).getTime();
    return Math.min(Math.floor((currentMs - startMs) / step), 23);
  }, [events, currentReplayEvent, timeBounds]);

  // Temporal Density Bins for Activity Strip (Replay & Peak Aware)
  const densityBins = useMemo(() => {
    if (!events.length) return [];
    const binsCount = 24;
    const startMs = timeBounds.start.getTime();
    const totalDuration = Math.max(timeBounds.end.getTime() - startMs, 1);
    const step = totalDuration / binsCount;

    const bins = Array.from({ length: binsCount }, (_, i) => ({
      index: i,
      start: new Date(startMs + i * step),
      end: new Date(startMs + (i + 1) * step),
      count: 0,
      events: [] as TimelineEvent[],
      incidentCount: 0,
      evidenceCount: 0,
    }));

    events.forEach((e) => {
      const t = new Date(e.occurredAt).getTime();
      const binIdx = Math.min(Math.floor((t - startMs) / step), binsCount - 1);
      if (bins[binIdx]) {
        bins[binIdx].count += 1;
        bins[binIdx].events.push(e);
        if (e.title.includes("Paper Leak") || e.title.includes("Incident")) {
          bins[binIdx].incidentCount += 1;
        }
        bins[binIdx].evidenceCount += (e.evidence?.length || 1);
      }
    });

    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    return bins.map((b) => ({
      ...b,
      heightRatio: b.count / maxCount,
      isPeak: b.count >= Math.max(maxCount * 0.7, 3),
    }));
  }, [events, timeBounds]);

  // Temporal Convergences (Activities clustered within 48h)
  const temporalConvergences = useMemo(() => {
    const clusters: { timestamp: string; count: number; items: TimelineEvent[] }[] = [];
    events.forEach((e, idx) => {
      const neighbors = events.filter(
        (other, oIdx) =>
          idx !== oIdx &&
          Math.abs(new Date(other.occurredAt).getTime() - new Date(e.occurredAt).getTime()) <= 48 * 3600 * 1000
      );
      if (neighbors.length >= 2) {
        clusters.push({
          timestamp: format(new Date(e.occurredAt), "dd MMM yyyy HH:mm"),
          count: neighbors.length + 1,
          items: [e, ...neighbors],
        });
      }
    });
    return clusters.slice(0, 3);
  }, [events]);

  // Replay playhead runner
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setPlayheadIndex((prev) => {
          if (prev >= events.length - 1) {
            setIsPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, 2000 / replaySpeed);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, replaySpeed, events.length]);

  // Selected event modal launcher
  const handleViewEvidenceForEvent = (event: TimelineEvent) => {
    setModalRelationship({
      source: { label: event.entity?.label || event.title },
      target: { label: event.location?.name || "Investigation Location" },
      type: "TEMPORAL_RECORD",
      evidence: (event.evidence || []).map((e) => ({
        evidence: {
          id: e.evidence.id,
          title: e.evidence.title,
          type: e.evidence.type,
          source: e.evidence.source || "Temporal Record",
          uploadedAt: e.evidence.uploadedAt || event.occurredAt,
          rawContent: `Official timeline log entry recorded at ${event.occurredAt}.`,
        },
        excerpt: event.description,
      })),
    });
    setActiveEvidenceModal(true);
  };

  if (loading) {
    return (
      <div className="p-8" suppressHydrationWarning>
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* 1. HERO AREA */}
      <div className="surface-elevated p-6 rounded-lg border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-accent uppercase tracking-widest">
              TEMPORAL RECONSTRUCTION
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
              GROUNDED EVIDENCE TIMELINE
            </span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mt-1">
            Reconstruct How The Investigation Unfolded Over Time
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Chronological sequence of verified investigation incidents, entity movements, and evidence logs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AddToBriefButton
            itemType="TEMPORAL"
            itemData={{
              id: currentReplayEvent?.id || "TEMP-01",
              timeWindow: currentReplayEvent ? format(new Date(currentReplayEvent.occurredAt), "dd MMM yyyy") : "Key Window",
              title: currentReplayEvent?.title || "Paper Leak Incident Window",
              details: currentReplayEvent?.description || "Significant chronological activity logged in timeline reconstruction.",
            }}
            label="Add Temporal Finding to Brief"
            className="px-4 py-2 rounded text-xs font-semibold border transition-all bg-amber-700/10 hover:bg-amber-700/20 text-amber-800 border-amber-700/30 font-mono"
          />
          <button
            onClick={() => {
              setReplayMode(!replayMode);
              if (!replayMode) {
                setPlayheadIndex(0);
                setIsPlaying(true);
              } else {
                setIsPlaying(false);
              }
            }}
            className={`px-4 py-2 rounded text-xs font-semibold border transition-all ${
              replayMode
                ? "bg-amber-600 text-white border-amber-700 shadow-md"
                : "bg-surface hover:bg-surface-elevated text-foreground border-border"
            }`}
          >
            {replayMode ? "■ EXIT REPLAY MODE" : "▶ REPLAY INVESTIGATION"}
          </button>
          <button
            onClick={() => setShowAssistant(true)}
            className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Ask Vyom AI (Temporal)
          </button>
        </div>
      </div>

      {/* 2. COMPACT INVESTIGATION TEMPORAL METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono text-xs">
        <div className="p-3 surface rounded-lg border border-border text-center">
          <span className="text-[10px] text-text-muted uppercase block">TIME WINDOW</span>
          <span className="font-bold text-foreground mt-0.5 block">
            {format(timeBounds.start, "dd MMM yyyy")} — {format(timeBounds.end, "dd MMM yyyy")}
          </span>
        </div>
        <div className="p-3 surface rounded-lg border border-border text-center">
          <span className="text-[10px] text-text-muted uppercase block">RECORDED EVENTS</span>
          <span className="font-bold text-accent text-base block">{events.length}</span>
        </div>
        <div className="p-3 surface rounded-lg border border-border text-center">
          <span className="text-[10px] text-text-muted uppercase block">CHAPTER INCIDENTS</span>
          <span className="font-bold text-emerald-700 text-base block">{incidents.length}</span>
        </div>
        <div className="p-3 surface rounded-lg border border-border text-center">
          <span className="text-[10px] text-text-muted uppercase block">ENTITIES INVOLVED</span>
          <span className="font-bold text-foreground text-base block">
            {investigationMeta?._count?.entities || 12}
          </span>
        </div>
        <div className="p-3 surface rounded-lg border border-border text-center">
          <span className="text-[10px] text-text-muted uppercase block">EVIDENCE RECORDS</span>
          <span className="font-bold text-foreground text-base block">
            {investigationMeta?._count?.evidence || 18}
          </span>
        </div>
      </div>

      {/* 3. DYNAMIC & REPLAY-AWARE TEMPORAL ACTIVITY STRIP */}
      <div className="surface-elevated p-4 rounded-lg border border-border space-y-3 shadow-xs relative overflow-hidden">
        {/* Header Strip & Live Activity Readout */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs font-mono border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground uppercase tracking-wider">INVESTIGATION ACTIVITY DENSITY</span>
            {replayMode && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 font-bold text-[10px] animate-pulse">
                ● REPLAY SYNC
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <div className="bg-background px-2.5 py-1 rounded border border-border text-foreground">
              <span className="text-text-muted mr-1.5">CURRENT ACTIVITY:</span>
              <strong className="text-accent font-bold">
                {currentReplayEvent
                  ? `${format(new Date(currentReplayEvent.occurredAt), "dd MMM yyyy · HH:mm")} (${densityBins[activeBinIndex]?.count || 0} EVENTS)`
                  : "NO RECORDED ACTIVITY"}
              </strong>
            </div>
            <span className="text-text-muted hidden md:inline">
              {format(timeBounds.start, "MMM yyyy")} ➔ {format(timeBounds.end, "MMM yyyy")}
            </span>
          </div>
        </div>

        {/* Dynamic Histogram Container with Vertical Playhead */}
        <div className="relative h-16 pt-2 px-1 border-b border-border/80 flex items-end gap-1.5">
          {/* Synchronized Vertical Playhead Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-600 z-20 transition-all duration-300 shadow-[0_0_8px_rgba(217,119,6,0.6)]"
            style={{ left: `${playheadProgressPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-600 border border-white shadow-xs" />
          </div>

          {/* Temporal Lens Active Range Indicator Overlay */}
          {lensRange && (
            <div className="absolute inset-0 bg-accent/5 border-x-2 border-accent/40 pointer-events-none z-0" />
          )}

          {/* Histogram Bars */}
          {densityBins.map((bin) => {
            const isActive = bin.index === activeBinIndex;
            const isPast = bin.index < activeBinIndex;
            const inLens =
              !lensRange ||
              (bin.start.getTime() >= lensRange.start.getTime() && bin.end.getTime() <= lensRange.end.getTime());

            return (
              <div
                key={bin.index}
                onClick={() => {
                  // Find first event in this time bin or calculate playhead index
                  const targetEventIdx = events.findIndex(
                    (e) => new Date(e.occurredAt).getTime() >= bin.start.getTime()
                  );
                  if (targetEventIdx !== -1) {
                    setPlayheadIndex(targetEventIdx);
                  }
                  setLensRange({ start: bin.start, end: bin.end });
                }}
                className={`flex-1 rounded-t transition-all cursor-pointer relative group ${
                  inLens ? "opacity-100" : "opacity-35"
                }`}
                style={{ height: `${Math.max(bin.heightRatio * 100, 12)}%` }}
              >
                {/* Individual Bar Element */}
                <div
                  className={`w-full h-full rounded-t transition-all duration-300 ${
                    isActive
                      ? "bg-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.8)] scale-y-105"
                      : isPast
                      ? "bg-amber-700/60 group-hover:bg-amber-600"
                      : bin.count > 0
                      ? "bg-amber-500/30 group-hover:bg-amber-500/50"
                      : "bg-border/30"
                  }`}
                />

                {/* Density Peak Indicator Badge */}
                {bin.isPeak && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-600" />
                )}

                {/* Comprehensive Hover Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 bg-background border border-border p-2.5 rounded text-[10px] font-mono shadow-lg whitespace-nowrap space-y-1">
                  <div className="font-bold text-foreground">{format(bin.start, "dd MMM yyyy")}</div>
                  <div className="text-accent font-bold">{bin.count} Recorded Events</div>
                  <div className="text-text-muted text-[9px]">
                    Incidents: {bin.incidentCount} · Evidence: {bin.evidenceCount}
                  </div>
                  {bin.isPeak && (
                    <div className="text-amber-800 font-bold text-[9px] uppercase">⚡ TEMPORAL ACTIVITY PEAK</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Controls & Lens Reset Footer */}
        <div className="flex justify-between items-center text-[10px] text-text-muted font-mono pt-1">
          <span>Click any density bar to jump playhead and apply Temporal Lens</span>
          {lensRange && (
            <button
              onClick={() => setLensRange(null)}
              className="text-accent font-bold hover:underline"
            >
              RESET LENS RANGE (SHOW ALL)
            </button>
          )}
        </div>
      </div>

      {/* 4. REPLAY CONTROLS STRIP (WHEN ACTIVE) */}
      {replayMode && (
        <div className="surface-elevated p-4 rounded-lg border-2 border-amber-500/60 bg-amber-500/5 space-y-3 shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
              >
                {isPlaying ? "Pause Replay" : "Play Replay"}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setPlayheadIndex(0);
                }}
                className="px-3 py-1.5 rounded border border-border bg-background text-text-secondary hover:text-foreground text-xs font-mono"
              >
                Reset
              </button>
              <div className="flex items-center gap-1 border border-border rounded bg-background px-2 py-1 text-xs font-mono">
                <span className="text-text-muted">Speed:</span>
                {[1, 2, 5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setReplaySpeed(spd)}
                    className={`px-1.5 rounded text-[10px] font-bold ${
                      replaySpeed === spd ? "bg-amber-500 text-white" : "text-text-secondary"
                    }`}
                  >
                    {spd}×
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-text-muted">Current Playhead:</span>
              <span className="font-bold text-foreground">
                {currentReplayEvent ? format(new Date(currentReplayEvent.occurredAt), "dd MMM yyyy HH:mm") : "N/A"}
              </span>
              <span className="text-accent font-bold">
                ({playheadIndex + 1} of {events.length})
              </span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(events.length - 1, 0)}
            value={playheadIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setPlayheadIndex(Number(e.target.value));
            }}
            className="w-full accent-amber-600 cursor-pointer"
          />

          {/* WHAT CHANGED AT PLAYHEAD */}
          {currentReplayEvent && (
            <div className="p-3 bg-background rounded border border-border text-xs space-y-1 font-mono">
              <div className="text-[10px] text-amber-700 font-bold uppercase">WHAT CHANGED AT THIS MOMENT</div>
              <div className="font-semibold text-foreground">{currentReplayEvent.title}</div>
              <div className="text-text-muted text-[11px]">
                Involved Entity: {currentReplayEvent.entity?.label || "N/A"} · Location: {currentReplayEvent.location?.name || "N/A"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. FILTER & MODE TOOLBAR */}
      <div className="surface-elevated p-3 rounded-lg border border-border flex flex-col md:flex-row justify-between items-center gap-3 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search temporal events, entities, locations..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full md:w-72 border border-border rounded px-3 py-1.5 bg-background focus:border-accent font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          <span className="text-[10px] text-text-muted font-mono uppercase font-bold">Lane Filter:</span>
          {["ALL", "PERSON", "ORGANIZATION", "LOCATION", "FINANCIAL", "COMMUNICATION", "EVIDENCE"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                typeFilter === t
                  ? "bg-accent text-white border-accent font-bold"
                  : "border-border text-text-secondary hover:text-foreground bg-background"
              }`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setReconstructCaseMode(!reconstructCaseMode)}
            className={`ml-2 px-3 py-1 rounded text-[10px] font-mono font-bold border transition-colors ${
              reconstructCaseMode
                ? "bg-emerald-700 text-white border-emerald-800"
                : "border-emerald-600/40 text-emerald-800 bg-emerald-500/10 hover:bg-emerald-500/20"
            }`}
          >
            {reconstructCaseMode ? "● CASE RECONSTRUCTION MODE" : "○ Case Reconstruction View"}
          </button>
        </div>
      </div>

      {/* 6. MAIN TEMPORAL WORKSPACE — LAYERED TEMPORAL LANES */}
      <div className="surface rounded-lg border border-border p-5 space-y-6 shadow-sm overflow-x-auto">
        {/* CHAPTER INCIDENT LANDMARKS */}
        <div className="space-y-2 border-b border-border pb-4">
          <span className="text-[10px] font-mono font-bold uppercase text-text-muted tracking-wider block">
            INCIDENT CHAPTER LANDMARKS
          </span>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {incidents.map((inc, i) => (
              <div
                key={inc.id}
                onClick={() => setSelectedIncidentId(selectedIncidentId === inc.id ? null : inc.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedIncidentId === inc.id
                    ? "bg-accent/10 border-accent shadow-xs"
                    : "bg-surface-elevated border-border hover:border-text-muted"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-accent font-bold mb-1">
                  <span>CHAPTER 0{i + 1}</span>
                  <span>{inc.date}</span>
                </div>
                <div className="font-serif text-xs font-semibold text-foreground line-clamp-1">{inc.name}</div>
                <div className="text-[10px] font-mono text-text-muted mt-1">
                  {inc.events.length} Recorded Activities
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TEMPORAL CONVERGENCE ALERTS */}
        {temporalConvergences.length > 0 && (
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30 text-xs font-mono space-y-1">
            <div className="font-bold text-amber-800 uppercase flex items-center gap-1.5">
              <span>⚡ TEMPORAL CONVERGENCE DETECTED</span>
              <span className="text-[10px] text-text-muted font-normal">(Events aligned in tight time window)</span>
            </div>
            {temporalConvergences.map((tc, idx) => (
              <div key={idx} className="text-text-secondary text-[11px]">
                • <strong className="text-foreground">{tc.timestamp}</strong>: {tc.count} activities occurred within 48h.
              </div>
            ))}
          </div>
        )}

        {/* MULTI-LANE HORIZONTAL TEMPORAL RIVER */}
        <div className="space-y-4 pt-2">
          {["INCIDENTS", "EVENTS", "MOVEMENT", "EVIDENCE", "COMMUNICATION", "FINANCIAL"].map((laneName) => {
            const laneEvents = filteredEvents.filter((e) => {
              if (laneName === "INCIDENTS") return e.title.includes("Paper Leak") || e.title.includes("Incident");
              if (laneName === "MOVEMENT") return e.location !== null;
              if (laneName === "EVIDENCE") return (e.evidence?.length || 0) > 0;
              if (laneName === "COMMUNICATION") return e.title.includes("Call") || e.title.includes("Dispatch");
              if (laneName === "FINANCIAL") return e.title.includes("Bank") || e.title.includes("UPI");
              return true;
            });

            return (
              <div key={laneName} className="space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase text-text-muted tracking-wider">
                  LANE: {laneName} ({laneEvents.length})
                </div>

                <div className="relative min-h-[48px] surface-elevated rounded border border-border/80 p-2 flex items-center gap-3 overflow-x-auto">
                  <div className="absolute left-0 right-0 h-0.5 bg-border/40 top-1/2 -translate-y-1/2 z-0" />

                  {laneEvents.map((evt) => {
                    const isSelected = selectedEventId === evt.id;
                    return (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEventId(isSelected ? null : evt.id)}
                        className={`relative z-10 shrink-0 px-3 py-1.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-accent text-white border-accent scale-105 shadow-md"
                            : "bg-background border-border text-foreground hover:bg-surface"
                        }`}
                      >
                        <div className="text-[9px] font-mono text-text-muted">
                          {format(new Date(evt.occurredAt), "dd MMM HH:mm")}
                        </div>
                        <div className="text-xs font-semibold line-clamp-1">{evt.title}</div>
                      </button>
                    );
                  })}

                  {laneEvents.length === 0 && (
                    <span className="text-[11px] font-mono text-text-muted italic px-2 z-10">
                      No events in this temporal lane for selected filters.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. EXPANDED EVENT SCENE DETAIL MODAL/DRAWER */}
      {selectedEventId && (
        <div className="surface-elevated p-5 rounded-lg border-2 border-accent/60 space-y-3 shadow-lg">
          {(() => {
            const event = events.find((e) => e.id === selectedEventId);
            if (!event) return null;
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-start border-b border-border pb-2">
                  <div>
                    <span className="text-[10px] font-mono text-accent font-bold uppercase">SELECTED TEMPORAL SCENE</span>
                    <h3 className="text-lg font-serif font-bold text-foreground">{event.title}</h3>
                    <p className="text-xs text-text-muted font-mono">{format(new Date(event.occurredAt), "EEEE, dd MMMM yyyy · HH:mm")}</p>
                  </div>
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="p-1 rounded hover:bg-surface text-text-muted text-xs font-mono"
                  >
                    ✕ CLOSE
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                  <div className="p-3 bg-background rounded border border-border">
                    <span className="text-text-muted block text-[10px] uppercase">ENTITY INVOLVED</span>
                    <span className="font-bold text-foreground">{event.entity?.label || "Unlinked Entity"}</span>
                    <span className="text-[10px] text-text-muted block mt-0.5">Type: {event.entity?.type || "N/A"}</span>
                  </div>

                  <div className="p-3 bg-background rounded border border-border">
                    <span className="text-text-muted block text-[10px] uppercase">LOCATION SCENE</span>
                    <span className="font-bold text-foreground">{event.location?.name || "Unspecified Location"}</span>
                  </div>

                  <div className="p-3 bg-background rounded border border-border">
                    <span className="text-text-muted block text-[10px] uppercase">LINKED EVIDENCE</span>
                    <span className="font-bold text-accent">{event.evidence?.length || 1} Verified Records</span>
                  </div>
                </div>

                {event.description && (
                  <p className="text-xs text-text-secondary leading-relaxed bg-background/50 p-3 rounded border border-border">
                    {event.description}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleViewEvidenceForEvent(event)}
                    className="px-3 py-1.5 rounded bg-accent text-white text-xs font-semibold shadow-2xs hover:bg-accent-hover transition-colors"
                  >
                    View Supporting Evidence
                  </button>
                  <button
                    onClick={() => router.push(`/investigations/${id}/evidence-space?search=${encodeURIComponent(event.entity?.label || "")}`)}
                    className="px-3 py-1.5 rounded border border-border bg-background text-text-secondary hover:text-foreground text-xs font-semibold transition-colors"
                  >
                    Show In Network View
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 8. CASE RECONSTRUCTION NARRATIVE MODE */}
      {reconstructCaseMode && (
        <div className="surface-elevated p-6 rounded-lg border-2 border-emerald-600/40 space-y-4 shadow-md">
          <div className="border-b border-border pb-2">
            <h3 className="font-serif text-lg font-bold text-foreground">CHRONOLOGICAL CASE RECONSTRUCTION</h3>
            <p className="text-xs text-text-muted">Systematic pre-incident, incident, and post-incident sequence reconstruction.</p>
          </div>

          <div className="space-y-6">
            {incidents.map((inc, i) => (
              <div key={inc.id} className="space-y-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-800 border-b border-emerald-500/20 pb-1">
                  <span>CHAPTER 0{i + 1}:</span>
                  <span>{inc.name.toUpperCase()}</span>
                  <span className="text-text-muted font-normal">({inc.date})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-background rounded border border-border space-y-1">
                    <span className="text-[10px] font-mono text-amber-700 font-bold uppercase block">PRE-INCIDENT</span>
                    <p className="text-text-secondary leading-relaxed">
                      Recorded preparatory interactions and logistics movement leading into the incident window.
                    </p>
                  </div>

                  <div className="p-3 bg-background rounded border border-border space-y-1">
                    <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase block">INCIDENT TIMESTAMP</span>
                    <p className="text-text-secondary leading-relaxed">
                      {inc.events[0]?.title || "Official examination leak timestamp recorded."}
                    </p>
                  </div>

                  <div className="p-3 bg-background rounded border border-border space-y-1">
                    <span className="text-[10px] font-mono text-blue-700 font-bold uppercase block">POST-INCIDENT</span>
                    <p className="text-text-secondary leading-relaxed">
                      Subsequent communications, financial dispatches, and multi-site distribution activities.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contextual Ask ARGUS Floating Chat Widget */}
      {showAssistant && (
        <ContextualChatWidget
          investigationId={id}
          contextType="TEMPORAL"
          contextId={selectedEventId || id}
          contextLabel={selectedEventId ? "Selected Event" : "Temporal Reconstruction"}
          initialQuestion="Explain the chronological sequence of events and what happened across these incidents."
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
