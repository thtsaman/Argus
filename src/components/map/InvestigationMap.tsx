"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string | null;
  events: { id: string; title: string; occurredAt: string }[];
}

export default function InvestigationMap({ locations }: { locations: LocationData[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current).setView([24.0, 88.0], 7);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const bounds: L.LatLngExpression[] = [];

    locations.forEach((loc, index) => {
      const pos: L.LatLngExpression = [loc.latitude, loc.longitude];
      bounds.push(pos);

      const marker = L.circleMarker(pos, {
        radius: 6 + Math.min(loc.events.length, 10),
        fillColor: "#6b5344",
        color: "#2c2416",
        weight: 1,
        fillOpacity: 0.8,
      }).addTo(map);

      marker.bindPopup(
        `<strong>${loc.name}</strong><br/>${loc.region || ""}<br/>${loc.events.length} events`
      );

      if (index > 0) {
        const prev = locations[index - 1];
        L.polyline(
          [
            [prev.latitude, prev.longitude],
            [loc.latitude, loc.longitude],
          ],
          { color: "#6b5344", weight: 1.5, opacity: 0.5, dashArray: "6, 8" }
        ).addTo(map);
      }
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [locations]);

  return <div ref={mapRef} className="w-full h-full" />;
}
