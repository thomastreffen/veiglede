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

export type MapLibreReadinessSource =
  | "render"
  | "idle"
  | "sourcedata"
  | "features"
  | "styleLoaded"
  | "manual"
  | null;

export interface MapLibreDiagnostics {
  styleId: string;
  styleHost: string;
  paintedEnough: boolean;
  readinessSource: MapLibreReadinessSource;
  renderEventCount: number;
  idleEventCount: number;
  sourceDataEventCount: number;
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
  /** Canvas-level visual confirmation. */
  canvasComputedOpacity: string | null;
  canvasComputedDisplay: string | null;
  canvasComputedVisibility: string | null;
  canvasComputedBackground: string | null;
  /** Feature/layer composition for confirming actual paint. */
  featuresAtCenter: number;
  baseLayerIds: string[];
  firstSymbolLayerId: string | null;
  firstLineLayerId: string | null;
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
  // A blank one-layer style used by the "Force route-only" diagnostic. If the
  // orange line is visible against this, the issue is MapTiler styling; if not,
  // the issue is the route layer / canvas rendering itself.
  const routeOnlyStyle = useMemo<maplibregl.StyleSpecification>(() => ({
    version: 8,
    sources: {},
    layers: [{ id: "vg-bg", type: "background", paint: { "background-color": "#1f2937" } }],
  }), []);
  const bootstrapStyle = useMemo<maplibregl.StyleSpecification>(() => ({
    version: 8,
    sources: {},
    layers: [{ id: "vg-bootstrap-bg", type: "background", paint: { "background-color": "#0f172a" } }],
  }), []);
  const styleSpec: string | maplibregl.StyleSpecification = useMemo(
    () => variant === "route-only" ? routeOnlyStyle : buildMaptilerStyleUrl(maptilerKey, variant),
    [maptilerKey, variant, routeOnlyStyle],
  );
  const styleId = variant === "route-only"
    ? "route-only"
    : variant === "light"
      ? "streets-v2"
      : "streets-v2-dark";

  // Signal mount immediately so the parent's diagnostic badge shows progress.
  useEffect(() => { onStage?.("mounted"); }, [onStage]);

  const readySignalRef = useRef(false);
  const readinessInfoRef = useRef<{
    paintedEnough: boolean;
    readinessSource: MapLibreReadinessSource;
    renderEventCount: number;
    idleEventCount: number;
    sourceDataEventCount: number;
  }>({
    paintedEnough: false,
    readinessSource: null,
    renderEventCount: 0,
    idleEventCount: 0,
    sourceDataEventCount: 0,
  });

  const isFatalMapError = useCallback((status: number | null, msg: string | null) => {
    if (status === 401 || status === 403) return true;
    if (status === 404 && /(style|tile)/i.test(msg ?? "")) return true;
    return false;
  }, []);

  const inspectPaintState = useCallback((map: MlMap | null = mapRef.current) => {
    let sourceCount = 0;
    let layerCount = 0;
    let routeSourceAdded = false;
    let routeLayerAdded = false;
    let styleLoaded = false;
    let tilesLoaded = false;
    let loaded = false;
    let centerLngLat: [number, number] | null = null;
    let zoom: number | null = null;
    let canvasComputedOpacity: string | null = null;
    let canvasComputedDisplay: string | null = null;
    let canvasComputedVisibility: string | null = null;
    let canvasComputedBackground: string | null = null;
    let featuresAtCenter = 0;
    let canvasWidth = 0;
    let canvasHeight = 0;
    const baseLayerIds: string[] = [];
    let firstSymbolLayerId: string | null = null;
    let firstLineLayerId: string | null = null;

    const wrapperRect = containerRef.current?.getBoundingClientRect();
    const wrapperW = Math.round(wrapperRect?.width ?? sizeInfoRef.current.lastWrapperRect?.w ?? 0);
    const wrapperH = Math.round(wrapperRect?.height ?? sizeInfoRef.current.lastWrapperRect?.h ?? 0);

    if (map) {
      try {
        const s = map.getStyle();
        sourceCount = s?.sources ? Object.keys(s.sources).length : 0;
        layerCount = s?.layers?.length ?? 0;
        routeSourceAdded = !!map.getSource("vg-route");
        routeLayerAdded = !!map.getLayer("vg-route-line");
        styleLoaded = !!map.isStyleLoaded?.();
        tilesLoaded = !!map.areTilesLoaded?.();
        loaded = !!map.loaded?.();
        const c = map.getCenter();
        centerLngLat = [Number(c.lng.toFixed(4)), Number(c.lat.toFixed(4))];
        zoom = Number(map.getZoom().toFixed(2));
        for (const layer of s?.layers ?? []) {
          if (layer.type === "background" || layer.type === "fill" || layer.type === "raster") {
            if (baseLayerIds.length < 4) baseLayerIds.push(layer.id);
          }
          if (!firstSymbolLayerId && layer.type === "symbol") firstSymbolLayerId = layer.id;
          if (!firstLineLayerId && layer.type === "line") firstLineLayerId = layer.id;
        }
        try {
          const canvas = map.getCanvas();
          const cs = window.getComputedStyle(canvas);
          const rect = canvas.getBoundingClientRect();
          canvasWidth = Math.round(rect.width);
          canvasHeight = Math.round(rect.height);
          canvasComputedOpacity = cs.opacity;
          canvasComputedDisplay = cs.display;
          canvasComputedVisibility = cs.visibility;
          canvasComputedBackground = cs.backgroundColor;
        } catch { /* canvas not ready */ }
        try {
          const cp = map.project(map.getCenter());
          featuresAtCenter = map.queryRenderedFeatures([cp.x, cp.y]).length;
        } catch { /* not ready */ }
      } catch { /* style not ready */ }
    }

    const fatalError = isFatalMapError(lastErrorRef.current.status, lastErrorRef.current.msg);
    const paintedEnough =
      wrapperW > 0 &&
      wrapperH > 0 &&
      canvasWidth > 0 &&
      canvasHeight > 0 &&
      sourceCount > 0 &&
      layerCount > 0 &&
      !fatalError &&
      (featuresAtCenter > 0 || routeLayerAdded || baseLayerIds.length > 0 || loaded || tilesLoaded);

    return {
      sourceCount,
      layerCount,
      routeSourceAdded,
      routeLayerAdded,
      styleLoaded,
      tilesLoaded,
      loaded,
      centerLngLat,
      zoom,
      canvasComputedOpacity,
      canvasComputedDisplay,
      canvasComputedVisibility,
      canvasComputedBackground,
      featuresAtCenter,
      baseLayerIds,
      firstSymbolLayerId,
      firstLineLayerId,
      paintedEnough,
      canvasWidth,
      canvasHeight,
    };
  }, [isFatalMapError]);

  const promoteReadiness = useCallback((
    source: Exclude<MapLibreReadinessSource, null>,
    snapshot = inspectPaintState(),
  ) => {
    const map = mapRef.current;
    readinessInfoRef.current.paintedEnough = snapshot.paintedEnough;
    if (!snapshot.paintedEnough || !map) return false;

    readinessInfoRef.current.readinessSource = snapshot.featuresAtCenter > 0 ? "features" : source;
    if (readySignalRef.current) return true;

    readySignalRef.current = true;
    setReady(true);
    onReady?.();
    try {
      map.resize();
      sizeInfoRef.current.mapResizeCalls += 1;
    } catch { /* ignore */ }
    return true;
  }, [inspectPaintState, onReady]);

  const emitDiagnostics = useCallback(() => {
    if (!onDiagnostics) return;
    const snapshot = inspectPaintState();
    onDiagnostics({
      styleId,
      styleHost: variant === "route-only" ? "inline" : "api.maptiler.com",
      paintedEnough: snapshot.paintedEnough,
      readinessSource: readinessInfoRef.current.readinessSource,
      renderEventCount: readinessInfoRef.current.renderEventCount,
      idleEventCount: readinessInfoRef.current.idleEventCount,
      sourceDataEventCount: readinessInfoRef.current.sourceDataEventCount,
      styleLoaded: snapshot.styleLoaded,
      tilesLoaded: snapshot.tilesLoaded,
      sourceCount: snapshot.sourceCount,
      layerCount: snapshot.layerCount,
      routeSourceAdded: snapshot.routeSourceAdded,
      routeLayerAdded: snapshot.routeLayerAdded,
      lastError: lastErrorRef.current.msg,
      lastErrorHost: lastErrorRef.current.host,
      lastErrorStatus: lastErrorRef.current.status,
      firstPointApp: fitInfoRef.current.firstApp,
      firstPointMaplibre: fitInfoRef.current.firstMl,
      fitBoundsSW: fitInfoRef.current.sw,
      fitBoundsNE: fitInfoRef.current.ne,
      centerLngLat,
      zoom,
      waitCount: sizeInfoRef.current.waitCount,
      lastWrapperRect: sizeInfoRef.current.lastWrapperRect,
      mapCreationAttempted: sizeInfoRef.current.mapCreationAttempted,
      mapCreationSkippedReason: sizeInfoRef.current.mapCreationSkippedReason,
      resizeObserverFires: sizeInfoRef.current.resizeObserverFires,
      mapResizeCalls: sizeInfoRef.current.mapResizeCalls,
      firstValidSizeTs: sizeInfoRef.current.firstValidSizeTs,
      canvasComputedOpacity: snapshot.canvasComputedOpacity,
      canvasComputedDisplay: snapshot.canvasComputedDisplay,
      canvasComputedVisibility: snapshot.canvasComputedVisibility,
      canvasComputedBackground: snapshot.canvasComputedBackground,
      featuresAtCenter: snapshot.featuresAtCenter,
      baseLayerIds: snapshot.baseLayerIds,
      firstSymbolLayerId: snapshot.firstSymbolLayerId,
      firstLineLayerId: snapshot.firstLineLayerId,
    });
  }, [inspectPaintState, onDiagnostics, styleId, variant]);

  // Initialize map once — but only after the container actually has
  // non-zero dimensions. ML canvas creation against a 0×0 container leaves
  // tilesLoaded=false forever, so we wait via ResizeObserver and retry.
  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper || mapRef.current) return;
    if (!styleSpec) {
      sizeInfoRef.current.mapCreationSkippedReason = "no-style-url";
      emitDiagnostics();
      onError?.("no-style-url");
      return;
    }

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const tryCreate = (source: "initial" | "resize-observer") => {
      if (cancelled || mapRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      sizeInfoRef.current.lastWrapperRect = { w, h };
      if (source === "resize-observer") sizeInfoRef.current.resizeObserverFires += 1;
      if (w <= 0 || h <= 0) {
        sizeInfoRef.current.waitCount += 1;
        sizeInfoRef.current.mapCreationSkippedReason = `container-${w}x${h}`;
        emitDiagnostics();
        return;
      }
      if (!sizeInfoRef.current.firstValidSizeTs) {
        sizeInfoRef.current.firstValidSizeTs = Date.now();
      }
      sizeInfoRef.current.mapCreationAttempted = true;
      sizeInfoRef.current.mapCreationSkippedReason = null;

      let map: MlMap;
      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: styleSpec,
          center: [projected.origin.lng, projected.origin.lat],
          zoom: 5,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        onStage?.("mapCreated");
      } catch (err) {
        if (import.meta.env.DEV) console.debug("[TripMap] MapLibre init failed", err);
        sizeInfoRef.current.mapCreationSkippedReason = `init-error: ${(err as Error)?.message ?? "unknown"}`;
        emitDiagnostics();
        onError?.(`init: ${(err as Error)?.message ?? "unknown"}`);
        return;
      }
      // Immediately call resize so MapLibre matches the wrapper exactly.
      try { map.resize(); sizeInfoRef.current.mapResizeCalls += 1; } catch { /* ignore */ }

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      let signaled = false;
      const signalReady = () => {
        if (signaled) return;
        if (!map.isStyleLoaded?.()) return;
        signaled = true;
        setReady(true);
        onReady?.();
        try { map.resize(); sizeInfoRef.current.mapResizeCalls += 1; } catch { /* ignore */ }
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
        if (!signaled || status === 401 || status === 403) {
          onError?.(`maplibre: ${status ?? ""} ${msg ?? ""}`.trim());
        }
      });
      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point);
        if (features.length === 0) onSelectStop?.(null);
      });

      mapRef.current = map;
      emitDiagnostics();
    };

    // Observe wrapper size; create map once it's non-zero. Also keep observing
    // so we can call map.resize() on later layout changes.
    ro = new ResizeObserver(() => {
      if (!mapRef.current) {
        tryCreate("resize-observer");
      } else {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) {
          sizeInfoRef.current.lastWrapperRect = { w: Math.round(r.width), h: Math.round(r.height) };
          sizeInfoRef.current.resizeObserverFires += 1;
          try { mapRef.current.resize(); sizeInfoRef.current.mapResizeCalls += 1; } catch { /* ignore */ }
          emitDiagnostics();
        }
      }
    });
    ro.observe(wrapper);
    // Try immediately in case layout is already settled.
    tryCreate("initial");

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot-swap style when the variant prop changes (e.g. debug "Use streets style").
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      map.setStyle(styleSpec);
      // Style swap drops sources/layers — re-add route on next styledata.
    } catch (err) {
      if (import.meta.env.DEV) console.debug("[TripMap] setStyle failed", err);
    }
  }, [styleSpec, ready]);

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
        // Casing first (white halo for contrast against any base style),
        // then the bright orange line on top. Both sit on the topmost slot
        // so they remain visible regardless of base style layers.
        map.addLayer({
          id: "vg-route-glow",
          type: "line",
          source: "vg-route",
          paint: { "line-color": DAY_COLORS[0], "line-width": 16, "line-opacity": 0.22, "line-blur": 8 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "vg-route-casing",
          type: "line",
          source: "vg-route",
          paint: { "line-color": "#ffffff", "line-width": compact ? 8 : 12, "line-opacity": 0.95 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "vg-route-line",
          type: "line",
          source: "vg-route",
          paint: {
            "line-color": DAY_COLORS[0],
            "line-width": compact ? 5 : 8,
            "line-opacity": 1,
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
