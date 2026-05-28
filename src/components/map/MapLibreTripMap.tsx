// Real (tile-based) map renderer using MapLibre GL + MapTiler.
//
// Rebuilt from the working /map-test pattern. Keep this file simple:
// create the map on mount with a working MapTiler style, mark ready on
// "load", then add the route source/layer and markers. No fancy readiness
// gates, no ResizeObserver tricks beyond a single resize() after mount.

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

export interface CssSnapshot {
  opacity: string;
  display: string;
  visibility: string;
  zIndex: string;
  position: string;
}

export interface MapLibreDiagnostics {
  styleId: string;
  styleHost: string;
  mapCreated: boolean;
  styleLoaded: boolean;
  sourceCount: number;
  layerCount: number;
  routeSourceAdded: boolean;
  routeLayerAdded: boolean;
  canvasW: number;
  canvasH: number;
  centerLngLat: [number, number] | null;
  zoom: number | null;
  routeGeometryLen: number;
  lastError: string | null;
  cssCanvas: CssSnapshot | null;
  cssContainer: CssSnapshot | null;
  cssParent: CssSnapshot | null;
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
  variant?: "dark" | "light" | "route-only";
  onError?: (msg?: string) => void;
  onReady?: () => void;
  onStage?: (stage: MapLibreStage) => void;
  onDiagnostics?: (d: MapLibreDiagnostics) => void;
  /** MapTiler browser key fetched at runtime via /api/public/map-config. */
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
  className,
  suggestionPins = [],
  hoveredSuggestionId,
  compact = false,
  variant = "light",
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
  const lastErrorRef = useRef<string | null>(null);

  const projected = useMemo(() => projectTrip(trip, days, stops), [trip, days, stops]);

  const styleUrl = useMemo(() => buildMaptilerStyleUrl(maptilerKey, variant === "dark" ? "dark" : "light"), [maptilerKey, variant]);
  const styleId = variant === "light" ? "streets-v2" : variant === "dark" ? "streets-v2-dark" : "route-only";
  const styleHost = (() => { try { return new URL(styleUrl).host; } catch { return ""; } })();

  const snapCss = useCallback((el: Element | null | undefined): CssSnapshot | null => {
    if (!el || typeof window === "undefined") return null;
    const s = window.getComputedStyle(el);
    return {
      opacity: s.opacity,
      display: s.display,
      visibility: s.visibility,
      zIndex: s.zIndex,
      position: s.position,
    };
  }, []);

  const emitDiagnostics = useCallback(() => {
    const map = mapRef.current;
    if (!onDiagnostics) return;
    const container = containerRef.current;
    const parent = container?.parentElement ?? null;
    if (!map) {
      onDiagnostics({
        styleId, styleHost, mapCreated: false, styleLoaded: false,
        sourceCount: 0, layerCount: 0, routeSourceAdded: false, routeLayerAdded: false,
        canvasW: 0, canvasH: 0, centerLngLat: null, zoom: null,
        routeGeometryLen: routeGeom?.length ?? 0, lastError: lastErrorRef.current,
        cssCanvas: null,
        cssContainer: snapCss(container),
        cssParent: snapCss(parent),
      });
      return;
    }
    const style = map.getStyle();
    const canvas = map.getCanvas();
    const c = map.getCenter();
    onDiagnostics({
      styleId, styleHost,
      mapCreated: true,
      styleLoaded: Boolean(map.isStyleLoaded()),
      sourceCount: style?.sources ? Object.keys(style.sources).length : 0,
      layerCount: style?.layers?.length ?? 0,
      routeSourceAdded: Boolean(map.getSource("vg-route")),
      routeLayerAdded: Boolean(map.getLayer("vg-route-line")),
      canvasW: canvas?.width ?? 0,
      canvasH: canvas?.height ?? 0,
      centerLngLat: [Number(c.lng.toFixed(4)), Number(c.lat.toFixed(4))],
      zoom: Number(map.getZoom().toFixed(2)),
      routeGeometryLen: routeGeom?.length ?? 0,
      lastError: lastErrorRef.current,
      cssCanvas: snapCss(canvas),
      cssContainer: snapCss(container),
      cssParent: snapCss(parent),
    });
  }, [onDiagnostics, styleId, styleHost, routeGeom, snapCss]);

  // Signal mount.
  useEffect(() => { onStage?.("mounted"); }, [onStage]);

  // Create the map ONCE on mount. Mirrors /map-test exactly.
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [10.7522, 59.9139], // default: Oslo
        zoom: 5,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorRef.current = msg;
      onError?.(msg);
      emitDiagnostics();
      return;
    }
    mapRef.current = map;
    onStage?.("mapCreated");
    emitDiagnostics();

    map.on("error", (e) => {
      const msg = e.error?.message ?? "map error";
      lastErrorRef.current = msg;
      emitDiagnostics();
    });

    map.on("load", () => {
      if (cancelled) return;
      onStage?.("styleLoaded");
      onStage?.("firstRender");
      try { map.resize(); } catch { /* noop */ }
      setReady(true);
      onReady?.();
      emitDiagnostics();
    });

    map.on("idle", emitDiagnostics);

    return () => {
      cancelled = true;
      try { map.remove(); } catch { /* noop */ }
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style when variant changes (without recreating the map).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { map.setStyle(styleUrl); } catch { /* noop */ }
  }, [styleUrl]);

  // Fetch route via ORS when not provided.
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

  // Add/update route layer and fit bounds. Also re-runs after setStyle().
  const addRouteAndFit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const geom: LatLng[] = (routeGeom && routeGeom.length > 1) ? routeGeom : [
      projected.origin,
      ...projected.mapped.map((m) => m.loc),
      projected.destination,
    ];
    if (geom.length < 2) return;

    const coords: [number, number][] = geom.map((p) => [p.lng, p.lat]);
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };

    try {
      const src = map.getSource("vg-route") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
      } else {
        map.addSource("vg-route", { type: "geojson", data });
        map.addLayer({
          id: "vg-route-casing",
          type: "line",
          source: "vg-route",
          paint: { "line-color": "#ffffff", "line-width": compact ? 7 : 10, "line-opacity": 0.95 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "vg-route-line",
          type: "line",
          source: "vg-route",
          paint: { "line-color": DAY_COLORS[0], "line-width": compact ? 4 : 6 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      onStage?.("routeLayerAdded");

      // Fit bounds to the route.
      let minLng = coords[0][0], maxLng = coords[0][0];
      let minLat = coords[0][1], maxLat = coords[0][1];
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: compact ? 32 : 56, duration: 400, maxZoom: 11,
      });
      emitDiagnostics();
    } catch (err) {
      lastErrorRef.current = `route-layer: ${(err as Error)?.message ?? "unknown"}`;
      emitDiagnostics();
    }
  }, [routeGeom, projected, ready, compact, onStage, emitDiagnostics]);

  useEffect(() => { addRouteAndFit(); }, [addRouteAndFit]);

  // After style swap, sources/layers are dropped — re-add.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      if (!map.getSource("vg-route")) addRouteAndFit();
    };
    map.on("styledata", handler);
    return () => { map.off("styledata", handler); };
  }, [addRouteAndFit]);

  // Markers (origin, destination, stops, suggestions).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const addMarker = (loc: LatLng, el: HTMLElement) => {
      const m = new maplibregl.Marker({ element: el }).setLngLat([loc.lng, loc.lat]).addTo(map);
      markersRef.current.push(m);
    };

    addMarker(projected.origin, pinEl("A", DAY_COLORS[0]));
    addMarker(projected.destination, pinEl("B", "#e9b54a"));

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
        marker.togglePopup();
      }
      markersRef.current.push(marker);
    });

    suggestionPins.forEach((p) => {
      const active = hoveredSuggestionId === p.id;
      addMarker(p.loc, suggestionEl(p.emoji, active));
    });
  }, [projected, suggestionPins, hoveredSuggestionId, selectedStopId, onSelectStop, ready]);

  // Match /map-test: a single container that the map mounts into. No
  // intermediate wrapper, no opacity tricks, no rounded clipping that could
  // interact with the WebGL canvas during init.
  return (
    <div ref={containerRef} className={cn("h-full w-full", className)} />
  );
}

// --- DOM helpers for markers ---

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
