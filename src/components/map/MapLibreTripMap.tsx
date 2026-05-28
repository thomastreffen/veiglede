// Real (tile-based) map renderer using MapLibre GL + MapTiler.
// This file is only imported when mapConfig.hasRealMap is true, so the
// SVG fallback path stays free of MapLibre's runtime cost.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** First route point as the app stores it ({lat,lng}). */
  firstPointApp: { lat: number; lng: number } | null;
  /** First route point in MapLibre's GeoJSON order ([lng, lat]). */
  firstPointMaplibre: [number, number] | null;
  /** Bounds passed to fitBounds, in lng/lat order. */
  fitBoundsSW: [number, number] | null;
  fitBoundsNE: [number, number] | null;
  /** Map state after fitBounds: center in [lng, lat] and zoom. */
  centerLngLat: [number, number] | null;
  zoom: number | null;
  /** Sizing / init lifecycle counters. */
  waitCount: number;
  lastWrapperRect: { w: number; h: number } | null;
  mapCreationAttempted: boolean;
  mapCreationSkippedReason: string | null;
  resizeObserverFires: number;
  mapResizeCalls: number;
  firstValidSizeTs: number | null;
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
  onDiagnostics,
  maptilerKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [routeGeom, setRouteGeom] = useState<LatLng[] | null>(trip.routeGeometry ?? null);
  const lastErrorRef = useRef<{ msg: string | null; host: string | null; status: number | null }>(
    { msg: null, host: null, status: null },
  );
  const fitInfoRef = useRef<{
    firstApp: { lat: number; lng: number } | null;
    firstMl: [number, number] | null;
    sw: [number, number] | null;
    ne: [number, number] | null;
  }>({ firstApp: null, firstMl: null, sw: null, ne: null });
  const sizeInfoRef = useRef<{
    waitCount: number;
    lastWrapperRect: { w: number; h: number } | null;
    mapCreationAttempted: boolean;
    mapCreationSkippedReason: string | null;
    resizeObserverFires: number;
    mapResizeCalls: number;
    firstValidSizeTs: number | null;
  }>({
    waitCount: 0,
    lastWrapperRect: null,
    mapCreationAttempted: false,
    mapCreationSkippedReason: null,
    resizeObserverFires: 0,
    mapResizeCalls: 0,
    firstValidSizeTs: null,
  });

  const projected = useMemo(() => projectTrip(trip, days, stops), [trip, days, stops]);
  const styleUrl = useMemo(() => buildMaptilerStyleUrl(maptilerKey, variant), [maptilerKey, variant]);
  const styleId = variant === "light" ? "streets-v2" : "streets-v2-dark";

  // Signal mount immediately so the parent's diagnostic badge shows progress.
  useEffect(() => { onStage?.("mounted"); }, [onStage]);

  const emitDiagnostics = useCallback(() => {
    const map = mapRef.current;
    if (!map || !onDiagnostics) return;
    let sourceCount = 0;
    let layerCount = 0;
    let routeSourceAdded = false;
    let routeLayerAdded = false;
    try {
      const s = map.getStyle();
      sourceCount = s?.sources ? Object.keys(s.sources).length : 0;
      layerCount = s?.layers?.length ?? 0;
      routeSourceAdded = !!map.getSource("vg-route");
      routeLayerAdded = !!map.getLayer("vg-route-line");
    } catch { /* style not ready */ }
    let centerLngLat: [number, number] | null = null;
    let zoom: number | null = null;
    try {
      const c = map.getCenter();
      centerLngLat = [Number(c.lng.toFixed(4)), Number(c.lat.toFixed(4))];
      zoom = Number(map.getZoom().toFixed(2));
    } catch { /* not ready */ }
    onDiagnostics({
      styleId,
      styleHost: "api.maptiler.com",
      styleLoaded: !!map.isStyleLoaded?.(),
      tilesLoaded: !!map.areTilesLoaded?.(),
      sourceCount,
      layerCount,
      routeSourceAdded,
      routeLayerAdded,
      lastError: lastErrorRef.current.msg,
      lastErrorHost: lastErrorRef.current.host,
      lastErrorStatus: lastErrorRef.current.status,
      firstPointApp: fitInfoRef.current.firstApp,
      firstPointMaplibre: fitInfoRef.current.firstMl,
      fitBoundsSW: fitInfoRef.current.sw,
      fitBoundsNE: fitInfoRef.current.ne,
      centerLngLat,
      zoom,
    });
  }, [onDiagnostics, styleId]);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!styleUrl) { onError?.("no-style-url"); return; }
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
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
      if (!map.isStyleLoaded?.()) return;
      signaled = true;
      setReady(true);
      onReady?.();
      // Container may have settled to its final size after layout — force a
      // resize so the canvas matches and tiles cover the full viewport.
      try { map.resize(); } catch { /* ignore */ }
    };
    map.on("load", () => { onStage?.("styleLoaded"); signalReady(); emitDiagnostics(); });
    map.on("styledata", () => { onStage?.("styleLoaded"); signalReady(); emitDiagnostics(); });
    map.on("sourcedata", () => emitDiagnostics());
    map.on("render", () => { onStage?.("firstRender"); signalReady(); });
    map.on("idle", () => { signalReady(); emitDiagnostics(); });
    map.on("error", (e) => {
      const errAny = e as { error?: { status?: number; message?: string; url?: string } };
      const status = errAny.error?.status ?? null;
      const msg = errAny.error?.message ?? null;
      const url = errAny.error?.url ?? null;
      let host: string | null = null;
      try { if (url) host = new URL(url).host; } catch { /* ignore */ }
      lastErrorRef.current = { msg, host, status };
      emitDiagnostics();
      if (import.meta.env.DEV) console.debug("[TripMap] MapLibre error", { status, host, msg, signaled });
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

  // Hot-swap style when the variant prop changes (e.g. debug "Use streets style").
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      map.setStyle(styleUrl);
      // Style swap drops sources/layers — re-add route on next styledata.
    } catch (err) {
      if (import.meta.env.DEV) console.debug("[TripMap] setStyle failed", err);
    }
  }, [styleUrl, ready]);

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
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const first = (routeGeom && routeGeom[0]) ?? pts[0];
    fitInfoRef.current = {
      firstApp: { lat: Number(first.lat.toFixed(4)), lng: Number(first.lng.toFixed(4)) },
      firstMl: [Number(first.lng.toFixed(4)), Number(first.lat.toFixed(4))],
      sw: [Number(sw.lng.toFixed(4)), Number(sw.lat.toFixed(4))],
      ne: [Number(ne.lng.toFixed(4)), Number(ne.lat.toFixed(4))],
    };
    map.fitBounds(bounds, { padding: compact ? 32 : 56, duration: 400, maxZoom: 11 });
    emitDiagnostics();
  }, [projected, suggestionPins, routeGeom, ready, compact, emitDiagnostics]);

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

  // Render route line as a GeoJSON source/layer. Re-runs after setStyle()
  // because the styledata listener bumps `ready` indirectly via diagnostics,
  // but to be safe we also listen for styledata here and re-add.
  const addRouteLayer = useCallback(() => {
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
        // Add as last layers — they'll sit on top of every base style layer,
        // so even if base tiles are blank the route is still visible.
        map.addLayer({
          id: "vg-route-glow",
          type: "line",
          source: "vg-route",
          paint: { "line-color": DAY_COLORS[0], "line-width": 14, "line-opacity": 0.22, "line-blur": 8 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "vg-route-line",
          type: "line",
          source: "vg-route",
          paint: {
            "line-color": DAY_COLORS[0],
            "line-width": compact ? 5 : 7,
            "line-dasharray": routeGeom ? [1, 0] : [2, 2],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      onStage?.("routeLayerAdded");
      emitDiagnostics();
    } catch (err) {
      if (import.meta.env.DEV) console.debug("[TripMap] route layer add failed", err);
      lastErrorRef.current = { ...lastErrorRef.current, msg: `route-layer: ${(err as Error)?.message ?? "unknown"}` };
      emitDiagnostics();
    }
  }, [routeGeom, projected, ready, compact, onStage, emitDiagnostics]);

  useEffect(() => { addRouteLayer(); }, [addRouteLayer]);

  // After a style swap (variant change) MapLibre drops our source/layer.
  // Re-add once the new style finishes loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      if (!map.getSource("vg-route")) addRouteLayer();
    };
    map.on("styledata", handler);
    return () => { map.off("styledata", handler); };
  }, [addRouteLayer]);

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
