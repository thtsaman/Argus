"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { PageHeader, SectionHeader, LoadingState } from "@/components/ui/common";

interface TimelineEvent {
  id: string;
  title: string;
  description: string | null;
  occurredAt: string;
  entity: { label: string; type: string } | null;
  location: { name: string } | null;
}

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/investigations/${id}/events`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
        setLoading(false);
      });
  }, [id]);

  const filtered = filter
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(filter.toLowerCase()) ||
          e.entity?.label.toLowerCase().includes(filter.toLowerCase())
      )
    : events;

  if (loading) return <div className="p-8"><LoadingState /></div>;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">
      <PageHeader
        title="Timeline"
        description="Temporal sequence of investigation events. Select events to inspect details."
      />

      <div className="mb-6">
        <input
          type="text"
          placeholder="Filter by event or entity..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full text-sm border border-border rounded px-3 py-2 bg-surface-elevated"
        />
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-1">
          {filtered.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(selectedEvent === event.id ? null : event.id)}
              className={`w-full text-left pl-10 pr-4 py-3 relative transition-colors ${
                selectedEvent === event.id ? "bg-surface-elevated" : "hover:bg-surface"
              }`}
            >
              <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-accent bg-surface-elevated" />
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.entity && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {event.entity.label} ({event.entity.type})
                    </p>
                  )}
                </div>
                <time className="text-xs text-text-muted shrink-0">
                  {format(new Date(event.occurredAt), "dd MMM yyyy HH:mm")}
                </time>
              </div>
              {selectedEvent === event.id && (
                <div className="mt-2 pt-2 border-t border-border">
                  {event.description && <p className="text-sm text-text-secondary">{event.description}</p>}
                  {event.location && (
                    <p className="text-xs text-text-muted mt-1">Location: {event.location.name}</p>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-text-muted text-center py-8">No events match the current filter.</p>
      )}
    </div>
  );
}
