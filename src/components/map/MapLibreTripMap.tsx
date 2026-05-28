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
import { getCachedRoute, mapConfig } from "@/lib/map";
import { buildMaptilerStyleUrl } from "@/lib/map/runtime-config";
import { cn } from "@/lib/utils";

export type MapLibreStage =
  | "mounted"
  | "mapCreated"
  | "styleLoaded"
  | "firstRender"
  | "routeLayerAdded";

export interface MapLibreDiagnostics {
  styleId: string;
  styleHost: string;
  styleLoaded: boolean;
  tilesLoaded: boolean;
  sourceCount: number;
  layerCount: number;
  routeSourceAdded: boolean;
  routeLayerAdded: boolean;
  lastError: string | null;
  lastErrorHost: string | null;
  lastErrorStatus: number | null;
}

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
  onError?: (msg?: string) => void;
  onReady?: () => void;
  onStage?: (stage: MapLibreStage) => void;
  onDiagnostics?: (d: MapLibreDiagnostics) => void;
  /** MapTiler browser key fetched at runtime via /api/public-map-config. */
  maptilerKey: string;
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
  onError,
  onReady,
  onStage,
  maptilerKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [routeGeom, setRouteGeom] = useState<LatLng[] | null>(trip.routeGeometry ?? null);

  const projected = useMemo(() => projectTrip(trip, days, stops), [trip, days, stops]);

  // Signal mount immediately so the parent's diagnostic badge shows progress.
  useEffect(() => { onStage?.("mounted"); }, [onStage]);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const style = buildMaptilerStyleUrl(maptilerKey, variant);
    if (!style) { onError?.("no-style-url"); return; }
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [projected.origin.lng, projected.origin.lat],
        zoom: 5,
        attributionControl: { compact: true },
        cooperativeGestures: false,
      });
      onStage?.("mapCreated");
    } catch (err) {
      if (import.meta.env.DEV) console.debug("[TripMap] MapLibre init failed", err);
      onError?.(`init: ${(err as Error)?.message ?? "unknown"}`);
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let signaled = false;
    const signalReady = () => {
      if (signaled) return;
      // Require the style to actually be loaded — otherwise we may flip the
      // overlay opaque before any tiles have been requested and the SVG
      // beneath stays visually dominant.
      if (!map.isStyleLoaded?.()) return;
      signaled = true;
      setReady(true);
      onReady?.();
    };
    map.on("load", () => { onStage?.("styleLoaded"); signalReady(); });
    map.on("styledata", () => { onStage?.("styleLoaded"); signalReady(); });
    map.on("render", () => { onStage?.("firstRender"); signalReady(); });
    map.on("idle", () => signalReady());
    map.on("error", (e) => {
      const status = (e as { error?: { status?: number; message?: string } }).error?.status;
      const msg = (e as { error?: { message?: string } }).error?.message;
      if (import.meta.env.DEV) console.debug("[TripMap] MapLibre error", { status, signaled, err: e });
      // Only treat as fatal before first frame, or on hard auth failures.
      if (!signaled || status === 401 || status === 403) {
        onError?.(`maplibre: ${status ?? ""} ${msg ?? ""}`.trim());
      }
    });
    // Click on empty map deselects.
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point);
      if (features.length === 0) onSelectStop?.(null);
    });

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
    try {
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
      onStage?.("routeLayerAdded");
    } catch (err) {
      if (import.meta.env.DEV) console.debug("[TripMap] route layer add failed", err);
      // Non-fatal: base map should still be visible.
    }
  }, [routeGeom, projected, ready, compact, onStage]);

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
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectStop?.(selected ? null : m.stop.id);
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([m.loc.lng, m.loc.lat]).addTo(map);
      if (selected) {
        const popup = new maplibregl.Popup({ offset: 22, closeButton: false, className: "vg-popup" })
          .setHTML(
            `<div style="font-family:inherit;padding:2px 4px;max-width:200px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${color};font-weight:700;">${meta.emoji} ${escapeHtml(meta.label ?? m.stop.type)}</div>
              <div style="font-size:13px;color:#111;font-weight:600;margin-top:2px;">${escapeHtml(m.stop.name)}</div>
              ${m.stop.location ? `<div style="font-size:11px;color:#555;margin-top:2px;">${escapeHtml(m.stop.location)}</div>` : ""}
            </div>`,
          );
        marker.setPopup(popup);
        // Open popup imperatively (Marker.togglePopup opens if closed)
        marker.togglePopup();
      }
      markersRef.current.push(marker);
    });

    // Suggestion pins
    suggestionPins.forEach((p) => {
      const active = hoveredSuggestionId === p.id;
      addMarker(p.loc, suggestionEl(p.emoji, active));
    });
  }, [projected, suggestionPins, hoveredSuggestionId, selectedStopId, onSelectStop, ready]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-2xl", className)}>
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
