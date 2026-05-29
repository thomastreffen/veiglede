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
import { stopMeta, tripsApi } from "@/lib/trips-store";
import type { LatLng } from "@/lib/geo";
import { distanceKm, nearestPointOnRoute, projectTrip } from "@/lib/geo";
import { getCachedRoute, mapConfig } from "@/lib/map";
import { getRoute } from "@/lib/routing";
import { buildMaptilerStyleUrl } from "@/lib/map/runtime-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function waypointHash(wps: LatLng[]): string {
  return wps.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join("|");
}
function formatDrivingTime(min: number): string {
  if (!min || min < 1) return "0min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

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
  const [recalculating, setRecalculating] = useState(false);
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

  // Waypoint-driven routing — recompute the route whenever the set of
  // route-affecting stops changes (origin, destination, and any stop whose
  // location we can resolve to real coordinates). Persists back to the trip
  // so distance/time stays honest and the cached geometry is reusable.
  const lastHashRef = useRef<string>("");
  const prevHashRef = useRef<string>(trip.routeWaypointsHash ?? "");
  useEffect(() => {
    // Only stops with real (non-approximated) coordinates participate in
    // routing. "detour"-typed stops are excluded — they're spurs, not via.
    const isValidLoc = (l: LatLng | undefined | null): l is LatLng =>
      !!l &&
      typeof l.lat === "number" && typeof l.lng === "number" &&
      Number.isFinite(l.lat) && Number.isFinite(l.lng) &&
      l.lat !== 0 && l.lng !== 0;
    const isAutoEndpoint = (name: string) => {
      const n = (name ?? "").toLowerCase();
      return n.includes("ankomst") || n.includes("avgang");
    };
    const stopWps = projected.mapped
      .filter((m) => !m.approximated)
      .filter((m) => (m.stop.routeStatus ?? "on-route") !== "detour")
      .filter((m) => {
        const s = m.stop as { placement?: string; type?: string; name: string };
        if (s.placement === "origin" || s.placement === "destination") return false;
        if (s.type === "origin" || s.type === "destination") return false;
        if (isAutoEndpoint(s.name)) return false;
        return true;
      })
      .filter((m) => {
        if (!isValidLoc(m.loc)) {
          // eslint-disable-next-line no-console
          console.warn("[veiglede] skipping waypoint with invalid coords", { name: m.stop.name, loc: m.loc });
          return false;
        }
        return true;
      })
      .filter((m) => distanceKm(m.loc, projected.origin) > 1 && distanceKm(m.loc, projected.destination) > 1)
      .map((m) => ({ loc: { lat: Number(m.loc.lat), lng: Number(m.loc.lng) }, name: m.stop.name }));
    const numOrigin: LatLng = { lat: Number(projected.origin.lat), lng: Number(projected.origin.lng) };
    const numDest: LatLng = { lat: Number(projected.destination.lat), lng: Number(projected.destination.lng) };
    const wps: LatLng[] = [numOrigin, ...stopWps.map((s) => s.loc), numDest];
    const hash = waypointHash(wps);
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    // Cache hit on the trip itself — no fetch, no update.
    if (hash === trip.routeWaypointsHash && trip.routeGeometry && trip.routeGeometry.length > 1) {
      setRouteGeom(trip.routeGeometry);
      prevHashRef.current = hash;
      return;
    }

    // Debug: log every recalc attempt with the waypoint plan so the user can
    // verify via-points are reaching ORS.
    const debug = {
      ts: new Date().toISOString(),
      waypointCount: wps.length,
      waypointNames: ["origin", ...stopWps.map((s) => s.name), "destination"],
      waypointCoords: wps.map((w) => [Number(w.lng), Number(w.lat)]),
    };
    // eslint-disable-next-line no-console
    console.info("[veiglede] route recalc →", debug);
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__veiglede_route_debug = debug;
    }

    let cancelled = false;
    const userChanged = prevHashRef.current !== "" && prevHashRef.current !== hash;
    setRecalculating(true);
    // Prefer multi-waypoint server route; fall back to direct ORS if the
    // legacy client-side key is present (single-segment only).
    const routeP = wps.length > 2
      ? getRoute({
          origin: numOrigin,
          destination: numDest,
          waypoints: stopWps.map((s) => s.loc),
          routeStyle: trip.style === "fastest" ? "fastest" : "scenic",
        }).then((r) => (r && r.geometry.length > 1 ? r : null))
      : (mapConfig.hasRouting
          ? getCachedRoute(wps)
          : getRoute({ origin: projected.origin, destination: projected.destination }).then((r) => r && r.geometry.length > 1 ? r : null));

    routeP.then((res) => {
      if (cancelled) return;
      setRecalculating(false);
      if (!res) {
        if (userChanged) {
          toast.error("Ruten kunne ikke beregnes på nytt. Beholder forrige rute.");
        }
        return;
      }
      // eslint-disable-next-line no-console
      console.info("[veiglede] route recalc ✓", {
        provider: res.provider,
        distanceKm: res.distanceKm,
        durationMin: res.durationMin,
        geomPts: res.geometry.length,
      });
      setRouteGeom(res.geometry);
      prevHashRef.current = hash;
      try {
        tripsApi.updateTrip(trip.id, {
          routeGeometry: res.geometry,
          routeDistanceKm: res.distanceKm,
          routeDurationMin: res.durationMin,
          routeWaypointsHash: hash,
          routeProvider: res.provider,
          distanceKm: Math.round(res.distanceKm),
          drivingTime: formatDrivingTime(res.durationMin),
        });
      } catch { /* noop */ }
      if (userChanged) {
        if (res.provider === "fallback" || res.provider === "demo") {
          toast.warning(`Ruta kunne ikke snappes til veinettet. Viser foreløpig estimat (${Math.round(res.distanceKm)} km).`);
        } else {
          toast.success(`Ruta er oppdatert via ${stopWps.length} via-punkt${stopWps.length === 1 ? "" : "er"} (${Math.round(res.distanceKm)} km).`);
        }
      }
    });
    return () => { cancelled = true; setRecalculating(false); };
  }, [projected, trip.id, trip.routeGeometry, trip.routeWaypointsHash, trip.style]);

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

    // Detour spurs: for each stop flagged as a detour, draw a dashed
    // amber line from the nearest point on the main route to the stop.
    const detourFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    projected.mapped.forEach((m) => {
      const status = m.stop.routeStatus ?? (m.stop.type === "detour" ? "detour" : "on-route");
      if (status !== "detour" || m.approximated) return;
      const anchor = nearestPointOnRoute(m.loc, geom);
      if (!anchor) return;
      detourFeatures.push({
        type: "Feature",
        properties: { stopId: m.stop.id },
        geometry: {
          type: "LineString",
          coordinates: [
            [anchor.lng, anchor.lat],
            [m.loc.lng, m.loc.lat],
          ],
        },
      });
    });
    const detourData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: "FeatureCollection",
      features: detourFeatures,
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

      const detourSrc = map.getSource("vg-detours") as maplibregl.GeoJSONSource | undefined;
      if (detourSrc) {
        detourSrc.setData(detourData);
      } else {
        map.addSource("vg-detours", { type: "geojson", data: detourData });
        map.addLayer({
          id: "vg-detours-casing",
          type: "line",
          source: "vg-detours",
          paint: { "line-color": "#1a1a1a", "line-width": compact ? 5 : 7, "line-opacity": 0.4 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        map.addLayer({
          id: "vg-detours-line",
          type: "line",
          source: "vg-detours",
          paint: {
            "line-color": "#f0b429", // amber
            "line-width": compact ? 3 : 4,
            "line-dasharray": [1.5, 1.5],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      onStage?.("routeLayerAdded");

      // Fit bounds to the route + detour spurs so the user always sees
      // how the detour relates to the main route.
      let minLng = coords[0][0], maxLng = coords[0][0];
      let minLat = coords[0][1], maxLat = coords[0][1];
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      for (const f of detourFeatures) {
        for (const [lng, lat] of f.geometry.coordinates) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
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

  // Explicit re-render on new route result. When ORS returns updated
  // geometry after a waypoint change, push it onto the existing source
  // via setData and refit the camera to the new path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!routeGeom || routeGeom.length < 2) return;
    const src = map.getSource("vg-route") as maplibregl.GeoJSONSource | undefined;
    if (!src) return; // initial add handled by addRouteAndFit
    const coords: [number, number][] = routeGeom.map((p) => [p.lng, p.lat]);
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };
    try {
      src.setData(data);
      let minLng = coords[0][0], maxLng = coords[0][0];
      let minLat = coords[0][1], maxLat = coords[0][1];
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800 });
      // eslint-disable-next-line no-console
      console.info("[veiglede] map route updated →", { pts: routeGeom.length });
    } catch (err) {
      lastErrorRef.current = `route-update: ${(err as Error)?.message ?? "unknown"}`;
    }
  }, [routeGeom, ready]);

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

    const originEl = pinEl("A", DAY_COLORS[0]);
    originEl.title = `${trip.origin} · start`;
    addMarker(projected.origin, originEl);

    const destEl = pinEl("B", "#e9b54a");
    destEl.title = `${trip.destination} · mål`;
    addMarker(projected.destination, destEl);

    projected.mapped.forEach((m) => {
      const meta = stopMeta(m.stop.type);
      const color = DAY_COLORS[m.dayIndex % DAY_COLORS.length];
      const selected = selectedStopId === m.stop.id;
      const status = m.stop.routeStatus ?? (m.stop.type === "detour" ? "detour" : "on-route");
      const isDetour = status === "detour";
      const el = stopEl(meta.emoji, isDetour ? "#f0b429" : color, selected, isDetour ? "detour" : "on-route");
      el.title = `${m.stop.name} · ${meta.label} · ${isDetour ? "avstikker" : "på rute"}`;
      const durationStr = m.stop.durationMin ? formatDrivingTime(m.stop.durationMin) : "";
      const labelColor = isDetour ? "#b07a00" : color;
      const extraLine = isDetour && (m.stop.extraDistanceKm != null || m.stop.distanceFromRouteKm != null)
        ? `<div style="font-size:11px;color:#b07a00;margin-top:4px;font-weight:600;">Avstikker${m.stop.extraDistanceKm != null ? ` +${m.stop.extraDistanceKm} km` : ""}${m.stop.distanceFromRouteKm != null ? ` · ${m.stop.distanceFromRouteKm} km fra ruta` : ""}</div>`
        : m.stop.distanceFromRouteKm != null
          ? `<div style="font-size:11px;color:#555;margin-top:2px;">📍 ${m.stop.distanceFromRouteKm} km fra ruta${m.stop.extraDistanceKm != null ? ` · +${m.stop.extraDistanceKm} km` : ""}</div>`
          : "";
      const promoteBtn = isDetour
        ? `<button data-vg-promote="${m.stop.id}" style="margin-top:8px;width:100%;padding:6px 8px;border-radius:8px;border:1px solid #2d8a5f;color:#2d8a5f;background:#fff;font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:.04em;">Gjør til via-punkt</button>`
        : "";
      const removeLabel = isDetour ? "Fjern avstikker" : "Fjern fra rute";
      const popupHtml = `<div style="font-family:inherit;padding:2px 4px;max-width:240px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${labelColor};font-weight:700;">${meta.emoji} ${escapeHtml(meta.label ?? m.stop.type)} · ${isDetour ? "avstikker" : "på rute"}</div>
            <div style="font-size:13px;color:#111;font-weight:600;margin-top:2px;">${escapeHtml(m.stop.name)}</div>
            ${m.stop.location ? `<div style="font-size:11px;color:#555;margin-top:2px;">${escapeHtml(m.stop.location)}</div>` : ""}
            ${extraLine}
            ${durationStr ? `<div style="font-size:11px;color:#555;margin-top:2px;">⏱ ${durationStr}</div>` : ""}
            ${promoteBtn}
            <button data-vg-center="${m.stop.id}" style="margin-top:6px;width:100%;padding:6px 8px;border-radius:8px;border:1px solid #ccc;color:#333;background:#fff;font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:.04em;">Vis i kart</button>
            <button data-vg-remove="${m.stop.id}" style="margin-top:6px;width:100%;padding:6px 8px;border-radius:8px;border:1px solid #d33;color:#d33;background:#fff;font-size:11px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:.04em;">${removeLabel}</button>
          </div>`;
      const popup = new maplibregl.Popup({ offset: 22, closeButton: true, className: "vg-popup" }).setHTML(popupHtml);

      const wirePopupActions = () => {
        requestAnimationFrame(() => {
          const popupEl = popup.getElement();
          if (!popupEl) return;
          popupEl.querySelector<HTMLButtonElement>(`[data-vg-remove="${m.stop.id}"]`)?.addEventListener("click", (ev) => {
            ev.stopPropagation();
            try { tripsApi.deleteStop(m.stop.id); } catch { /* noop */ }
            onSelectStop?.(null);
            toast.success(isDetour ? "Avstikker fjernet." : "Stoppet fjernet. Ruten oppdateres.");
          });
          popupEl.querySelector<HTMLButtonElement>(`[data-vg-promote="${m.stop.id}"]`)?.addEventListener("click", (ev) => {
            ev.stopPropagation();
            try {
              tripsApi.updateStop(m.stop.id, {
                placement: "along",
                routeStatus: "on-route",
                type: m.stop.type === "detour" ? "attraction" : m.stop.type,
              });
            } catch { /* noop */ }
            toast.success("Lagt inn som via-punkt. Ruten beregnes på nytt.");
          });
          popupEl.querySelector<HTMLButtonElement>(`[data-vg-center="${m.stop.id}"]`)?.addEventListener("click", (ev) => {
            ev.stopPropagation();
            try { map.flyTo({ center: [m.loc.lng, m.loc.lat], zoom: Math.max(map.getZoom(), 9), duration: 600 }); } catch { /* noop */ }
          });
        });
      };

      popup.on("open", wirePopupActions);

      const marker = new maplibregl.Marker({ element: el }).setLngLat([m.loc.lng, m.loc.lat]).addTo(map);
      marker.setPopup(popup);
      // Reliable click: always select; opening is owned by MapLibre's
      // default click handler on the marker element. Calling togglePopup
      // here as well would re-close a freshly-opened popup, which is the
      // "popup gets stuck" symptom users hit.
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectStop?.(m.stop.id);
      });
      if (selected && !popup.isOpen()) {
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
    <div className={cn("relative h-full w-full", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {recalculating && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-[11px] uppercase tracking-wider text-foreground/90 shadow-md backdrop-blur">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary mr-2 align-middle" />
          Beregner rute på nytt…
        </div>
      )}
    </div>
  );
}

// --- DOM helpers for markers ---

function pinEl(label: string, color: string) {
  const el = document.createElement("div");
  el.style.cssText = `width:30px;height:30px;border-radius:9999px;background:${color};color:#111;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:3px solid #fafafa;box-shadow:0 2px 6px rgba(0,0,0,.4);`;
  el.textContent = label;
  return el;
}

function stopEl(emoji: string, color: string, selected: boolean, status: "on-route" | "detour" = "on-route") {
  const size = selected ? 34 : 26;
  const el = document.createElement("div");
  const border = status === "detour" ? `${selected ? 3 : 2}px dashed #fafafa` : `${selected ? 3 : 2}px solid #fafafa`;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${color};display:flex;align-items:center;justify-content:center;font-size:${selected ? 16 : 13}px;border:${border};cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.4);transition:transform .15s;`;
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
