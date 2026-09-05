"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface GeoLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  region: string | null;
  address: string | null;
  events: {
    id: string;
    title: string;
    occurredAt: string;
    entity?: { id: string; label: string; type: string } | null;
    evidenceLinks?: { evidence: { id: string; title: string; type: string } }[];
  }[];
  incidents: string[];
}

export interface GeoMovement {
  id: string;
  title: string;
  vehicle: string;
  fromName: string;
  toName: string;
  fromCoords: [number, number]; // [lng, lat]
  toCoords: [number, number];
  timestamp: string;
  incident: string;
}

interface GeospatialMapProps {
  locations: GeoLocation[];
  selectedLocationId: string | null;
  onSelectLocation: (loc: GeoLocation | null) => void;
  mapStyle: "STANDARD" | "SATELLITE" | "TERRAIN";
  is3D: boolean;
  activeIncident: string;
  currentTimeIndex: number;
  timeEvents: any[];
  showDensity: boolean;
  isPlaying: boolean;
}

export default function GeospatialMap({
  locations,
  selectedLocationId,
  onSelectLocation,
  mapStyle,
  is3D,
  activeIncident,
  currentTimeIndex,
  timeEvents,
  showDensity,
  isPlaying,
}: GeospatialMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const animMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Free OpenStreetMap vector / raster tiles with MapLibre
    const styleObj: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "osm-tiles": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors",
        },
        "satellite-tiles": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        },
      },
      layers: [
        {
          id: "osm-layer",
          type: "raster",
          source: "osm-tiles",
          minzoom: 0,
          maxzoom: 19,
        },
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite-tiles",
          minzoom: 0,
          maxzoom: 19,
          layout: {
            visibility: "none",
          },
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleObj,
      center: [86.5, 23.2], // Centered over West Bengal / Bihar / Odisha corridor
      zoom: 6.8,
      pitch: 0,
      bearing: 0,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle map style toggle (Standard vs Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.getLayer("satellite-layer") && map.getLayer("osm-layer")) {
      if (mapStyle === "SATELLITE") {
        map.setLayoutProperty("satellite-layer", "visibility", "visible");
        map.setLayoutProperty("osm-layer", "visibility", "none");
      } else {
        map.setLayoutProperty("satellite-layer", "visibility", "none");
        map.setLayoutProperty("osm-layer", "visibility", "visible");
      }
    }
  }, [mapStyle]);

  // Handle 3D Perspective Pitch toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: is3D ? 52 : 0,
      bearing: is3D ? -18 : 0,
      duration: 1000,
    });
  }, [is3D]);

  // Render 3D Pillars & HTML Markers for Locations
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const filteredLocations = locations.filter((loc) => {
      if (activeIncident === "ALL") return true;
      return loc.incidents.includes(activeIncident);
    });

    filteredLocations.forEach((loc) => {
      const isSelected = loc.id === selectedLocationId;

      const el = document.createElement("div");
      el.className = "group relative cursor-pointer flex flex-col items-center justify-center";

      // 3D Vertical Pillar Effect + Marker
      el.innerHTML = `
        <div class="flex flex-col items-center transition-transform duration-300 transform hover:scale-110">
          <div class="px-2 py-1 bg-[#2c2416] text-[#faf7f2] font-mono text-[11px] font-semibold rounded border border-[#6b5344] shadow-md whitespace-nowrap mb-1 flex items-center gap-1.5 ${
            isSelected ? "ring-2 ring-emerald-500 bg-emerald-950 text-emerald-100" : ""
          }">
            <span class="w-2 h-2 rounded-full ${isSelected ? "bg-emerald-400 animate-ping" : "bg-amber-400"}"></span>
            ${loc.name}
            <span class="text-[9px] px-1 py-0.2 rounded bg-surface border border-border text-amber-300 font-bold">${loc.events.length}</span>
          </div>

          <!-- 3D Marker Pillar Stem -->
          <div class="w-0.5 ${is3D ? "h-12 bg-gradient-to-b from-amber-500/90 to-transparent" : "h-4 bg-amber-700/60"}"></div>

          <!-- Base Halo Ring -->
          <div class="w-5 h-5 rounded-full border-2 ${
            isSelected ? "border-emerald-400 bg-emerald-500/30 scale-125" : "border-amber-600 bg-amber-500/20"
          } flex items-center justify-center shadow-lg">
            <div class="w-2 h-2 rounded-full ${isSelected ? "bg-emerald-400" : "bg-amber-500"}"></div>
          </div>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectLocation(loc);

        map.flyTo({
          center: [loc.longitude, loc.latitude],
          zoom: Math.max(map.getZoom(), 11),
          speed: 1.2,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map);

      markersRef.current.set(loc.id, marker);
    });

    // Fly to bounds if no location is selected
    if (!selectedLocationId && filteredLocations.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      filteredLocations.forEach((l) => bounds.extend([l.longitude, l.latitude]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 12 });
    }
  }, [locations, selectedLocationId, activeIncident, is3D, onSelectLocation]);

  // Sync timeline replay state with map flyTo & animated movement marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || timeEvents.length === 0) return;

    const currentEv = timeEvents[currentTimeIndex];
    if (!currentEv || !currentEv.location) return;

    // Fly camera smoothly to active event location
    map.easeTo({
      center: [currentEv.location.longitude, currentEv.location.latitude],
      zoom: 9.5,
      duration: 1200,
    });

    // Update Replay Animated Rupee Vehicle Marker
    if (isPlaying) {
      if (!animMarkerRef.current) {
        const animEl = document.createElement("div");
        animEl.className = "flex items-center gap-1 bg-emerald-700 text-white font-mono text-[10px] font-bold px-2 py-1 rounded-full border border-white shadow-xl animate-bounce";
        animEl.innerHTML = `<span>🚗</span> <span>₹ MOVEMENT</span>`;
        animMarkerRef.current = new maplibregl.Marker({ element: animEl })
          .setLngLat([currentEv.location.longitude, currentEv.location.latitude])
          .addTo(map);
      } else {
        animMarkerRef.current.setLngLat([currentEv.location.longitude, currentEv.location.latitude]);
      }
    } else if (animMarkerRef.current) {
      animMarkerRef.current.remove();
      animMarkerRef.current = null;
    }
  }, [currentTimeIndex, timeEvents, isPlaying]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
