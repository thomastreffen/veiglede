// Real (tile-based) map renderer using MapLibre GL + MapTiler.
// This file is only imported when mapConfig.hasRealMap is true, so the
// SVG fallback path stays free of MapLibre's runtime cost.

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { Trip, TripDay, Stop } from "@/lib/trips-store";
import { stopMeta } from "@/lib/trips-store";
import type { LatLng } from "@/lib/geo";
import { projectTrip } from "@/lib/geo";
import { getCachedRoute, getMaptilerStyleUrl, mapConfig } from "@/lib/map";
import { cn } from "@/lib/utils";

interface Props {
  trip: Trip;
  days: TripDay[];
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stopId: string | null) => void;
  height?: string;
  className?: string;
  suggestionPins?: { id: string; name: string; loc: LatLng; emoji: string }[];
  hoveredSuggestionId?: string | null;
  compact?: boolean;
  variant?: "dark" | "light";
}

const DAY_COLORS = [
  "#f59e3a", // primary orange
  "#3fb7c2",
  "#65b56a",
  "#c668c4",
  "#e2c14a",
];

export function MapLibreTripMap({
  trip,
  days,
  stops,
  selectedStopId,
  onSelectStop,
  height = "h-64",
  className,
  suggestionPins = [],
  hoveredSuggestionId,
  compact = false,
  variant = "dark",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [routeGeom, setRouteGeom] = useState<LatLng[] | null>(trip.routeGeometry ?? null);

  const projected = useMemo(() => projectTrip(trip, days, stops), [trip, days, stops]);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const style = getMaptilerStyleUrl(variant);
    if (!style) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [projected.origin.lng, projected.origin.lat],
      zoom: 5,
      attributionControl: { compact: true },
      cooperativeGestures: compact,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit to bounds when projection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pts: LatLng[] = [
      projected.origin,
      projected.destination,
      ...projected.mapped.map((m) => m.loc),
      ...suggestionPins.map((p) => p.loc),
      ...(routeGeom ?? []),
    ];
    if (pts.length === 0) return;
    const bounds = pts.reduce(
      (acc, p) => acc.extend([p.lng, p.lat]),
      new maplibregl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]),
    );
    map.fitBounds(bounds, { padding: compact ? 32 : 56, duration: 400, maxZoom: 11 });
  }, [projected, suggestionPins, routeGeom, ready, compact]);

  // Fetch a real route when ORS is configured.
  useEffect(() => {
    if (!mapConfig.hasRouting) return;
    if (trip.routeGeometry && trip.routeGeometry.length > 1) {
      setRouteGeom(trip.routeGeometry);
      return;
    }
    const wps = [
      projected.origin,
      ...projected.mapped.map((m) => m.loc),
      projected.destination,
    ];
    let cancelled = false;
    getCachedRoute(wps).then((res) => {
      if (!cancelled && res) setRouteGeom(res.geometry);
    });
    return () => { cancelled = true; };
  }, [projected, trip.routeGeometry]);

  // Render route line as a GeoJSON source/layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const geom: LatLng[] = routeGeom ?? [
      projected.origin,
      ...projected.mapped.map((m) => m.loc),
      projected.destination,
    ];
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: geom.map((p) => [p.lng, p.lat]) },
    };
    const src = map.getSource("vg-route") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource("vg-route", { type: "geojson", data });
      map.addLayer({
        id: "vg-route-glow",
        type: "line",
        source: "vg-route",
        paint: { "line-color": DAY_COLORS[0], "line-width": 10, "line-opacity": 0.18, "line-blur": 6 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "vg-route-line",
        type: "line",
        source: "vg-route",
        paint: {
          "line-color": DAY_COLORS[0],
          "line-width": compact ? 3 : 4,
          "line-dasharray": routeGeom ? [1, 0] : [2, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
  }, [routeGeom, projected, ready, compact]);

  // Render markers (origin, destination, stops, suggestions).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const addMarker = (loc: LatLng, el: HTMLElement) => {
      const m = new maplibregl.Marker({ element: el }).setLngLat([loc.lng, loc.lat]).addTo(map);
      markersRef.current.push(m);
    };

    // Origin (A)
    addMarker(projected.origin, pinEl("A", DAY_COLORS[0]));
    // Destination (B)
    addMarker(projected.destination, pinEl("B", "#e9b54a"));

    // Stop pins
    projected.mapped.forEach((m) => {
      const meta = stopMeta(m.stop.type);
      const color = DAY_COLORS[m.dayIndex % DAY_COLORS.length];
      const selected = selectedStopId === m.stop.id;
      const el = stopEl(meta.emoji, color, selected);
      el.addEventListener("click", () => onSelectStop?.(selected ? null : m.stop.id));
      addMarker(m.loc, el);
    });

    // Suggestion pins
    suggestionPins.forEach((p) => {
      const active = hoveredSuggestionId === p.id;
      addMarker(p.loc, suggestionEl(p.emoji, active));
    });
  }, [projected, suggestionPins, hoveredSuggestionId, selectedStopId, onSelectStop, ready]);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-surface", height, className)}>
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}

// --- DOM helpers for markers (kept tiny so we don't pull React render into MapLibre) ---

function pinEl(label: string, color: string) {
  const el = document.createElement("div");
  el.style.cssText = `width:30px;height:30px;border-radius:9999px;background:${color};color:#111;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:3px solid #fafafa;box-shadow:0 2px 6px rgba(0,0,0,.4);`;
  el.textContent = label;
  return el;
}

function stopEl(emoji: string, color: string, selected: boolean) {
  const size = selected ? 34 : 26;
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${color};display:flex;align-items:center;justify-content:center;font-size:${selected ? 16 : 13}px;border:${selected ? 3 : 2}px solid #fafafa;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .15s;`;
  el.textContent = emoji;
  return el;
}

function suggestionEl(emoji: string, active: boolean) {
  const el = document.createElement("div");
  el.style.cssText = `width:${active ? 28 : 22}px;height:${active ? 28 : 22}px;border-radius:9999px;background:transparent;border:2px dashed #e2c14a;display:flex;align-items:center;justify-content:center;font-size:${active ? 14 : 11}px;opacity:${active ? 1 : 0.7};`;
  el.textContent = emoji;
  return el;
}
