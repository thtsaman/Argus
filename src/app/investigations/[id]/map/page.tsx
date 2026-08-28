"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PageHeader, LoadingState } from "@/components/ui/common";

const MapView = dynamic(() => import("@/components/map/InvestigationMap"), { ssr: false });

interface LocationData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string | null;
  events: { id: string; title: string; occurredAt: string }[];
}

export default function MapPage() {
  const { id } = useParams<{ id: string }>();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/investigations/${id}/locations`)
      .then((r) => r.json())
      .then((data) => {
        setLocations(data.locations || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8"><LoadingState /></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        title="Geographic visualization"
        description="Location-based view of investigation events and entity movements."
      />
      <div className="h-[600px] surface overflow-hidden">
        <MapView locations={locations} />
      </div>
    </div>
  );
}
