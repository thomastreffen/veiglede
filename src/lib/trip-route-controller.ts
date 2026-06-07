// Trip route controller — single source of truth for trip route calculation.
//
// The map component is purely presentational: it reads `trip.routeGeometry`
// and draws it. All waypoint-building, getRoute() calls, and writes back to
// `trip.routeGeometry / routeDistanceKm / routeDurationMin / routeProvider /
// routeWaypointsHash` must go through this module.
//
// Planner code (trip detail page, popup actions, EditTripSheet, suggestions)
// should call `recalculateTripRoute(tripId, reason)` whenever the set of
// route-affecting stops or endpoints changes.

import { tripsApi, type Stop, type Trip, type TripDay } from "@/lib/trips-store";
import type { LatLng } from "@/lib/geo";
import { getRoute, type RouteResult } from "@/lib/routing";

export type RecalcReason =
  | "add-via-point"
  | "remove-waypoint"
  | "reorder-waypoints"
  | "edit-trip-endpoints"
  | "stops-changed"
  | "manual";

export interface RouteWaypointInfo {
  loc: LatLng;
  name: string;
  stopId?: string;
}

export interface TripRouteClassification {
  origin: LatLng | null;
  destination: LatLng | null;
  viaPoints: RouteWaypointInfo[]; // ordered, on-route, with real coords
  detours: { stopId: string; name: string; loc: LatLng }[];
  suggestions: { stopId: string; name: string; loc: LatLng }[];
  ignored: { stopId: string; name: string; reason: string }[];
}

export interface RecalcResult {
  success: boolean;
  status: "ok" | "skipped" | "no-endpoints" | "error";
  provider?: string;
  waypointCount: number;
  waypointNames: string[];
  warnings?: string[];
  error?: string;
  hash?: string;
  reason: RecalcReason;
}

interface DebugSnapshot {
  ts: string;
  reason: RecalcReason;
  status: RecalcResult["status"];
  provider?: string;
  waypointCount: number;
  waypointNames: string[];
  hash?: string;
  geometryPoints?: number;
  error?: string;
}

let lastDebug: DebugSnapshot | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of Array.from(listeners)) {
    try { l(); } catch { /* noop */ }
  }
}

export function getLastRecalcDebug(): DebugSnapshot | null {
  return lastDebug;
}
export function subscribeRouteDebug(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function isValidLoc(l: { lat?: number; lng?: number } | undefined | null): l is LatLng {
  return !!l
    && typeof l.lat === "number" && typeof l.lng === "number"
    && Number.isFinite(l.lat) && Number.isFinite(l.lng)
    && l.lat !== 0 && l.lng !== 0;
}

function isAutoEndpointName(name: string): boolean {
  const n = (name ?? "").toLowerCase();
  return n.includes("ankomst") || n.includes("avgang");
}

function tripOriginLoc(trip: Trip): LatLng | null {
  return isValidLoc(trip.originLoc) ? trip.originLoc : null;
}
function tripDestLoc(trip: Trip): LatLng | null {
  return isValidLoc(trip.destinationLoc) ? trip.destinationLoc : null;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

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

/**
 * Classify stops by their role in the main route:
 *  - viaPoints: on-route stops with real coords → fed to the routing engine
 *  - detours: explicit avstikkere (off-route spurs)
 *  - suggestions: not yet committed to the route
 *  - ignored: stops dropped from waypoint list with reason
 *
 * Day ordering is preserved so via-points appear in travel order.
 */
export function classifyRouteStops(
  trip: Trip,
  days: TripDay[],
  stops: Stop[],
): TripRouteClassification {
  const origin = tripOriginLoc(trip);
  const destination = tripDestLoc(trip);

  const dayOrder = new Map(days.map((d) => [d.id, d.dayNumber]));
  const sorted = [...stops].sort((a, b) => {
    const da = dayOrder.get(a.dayId) ?? 0;
    const db = dayOrder.get(b.dayId) ?? 0;
    if (da !== db) return da - db;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  const viaPoints: RouteWaypointInfo[] = [];
  const detours: { stopId: string; name: string; loc: LatLng }[] = [];
  const suggestions: { stopId: string; name: string; loc: LatLng }[] = [];
  const ignored: { stopId: string; name: string; reason: string }[] = [];

  for (const s of sorted) {
    const loc: LatLng | null = isValidLoc({ lat: s.lat, lng: s.lng })
      ? { lat: s.lat as number, lng: s.lng as number }
      : null;
    const placement = s.placement;
    const status = s.routeStatus ?? (s.type === "detour" ? "detour" : "on-route");

    // Endpoint / auto-stop guards
    if (placement === "origin" || placement === "destination") {
      ignored.push({ stopId: s.id, name: s.name, reason: "endpoint-stop" });
      continue;
    }
    if (s.type === "origin" || s.type === "destination") {
      ignored.push({ stopId: s.id, name: s.name, reason: "endpoint-type" });
      continue;
    }
    if (isAutoEndpointName(s.name)) {
      ignored.push({ stopId: s.id, name: s.name, reason: "auto-endpoint" });
      continue;
    }

    if (status === "suggestion") {
      if (loc) suggestions.push({ stopId: s.id, name: s.name, loc });
      else ignored.push({ stopId: s.id, name: s.name, reason: "suggestion-no-coords" });
      continue;
    }
    if (status === "detour") {
      if (loc) detours.push({ stopId: s.id, name: s.name, loc });
      else ignored.push({ stopId: s.id, name: s.name, reason: "detour-no-coords" });
      continue;
    }

    // Lodging that is not explicitly placed "along" the route is treated as
    // an overnight that doesn't add a via-point (the route already passes
    // through the city). Only lodgings the planner explicitly marked as
    // along the route participate as via-points.
    if (s.type === "lodging" && placement !== "along") {
      ignored.push({ stopId: s.id, name: s.name, reason: "lodging-not-via" });
      continue;
    }

    if (!loc) {
      ignored.push({ stopId: s.id, name: s.name, reason: "no-coords" });
      continue;
    }
    if (origin && haversineKm(loc, origin) < 1) {
      ignored.push({ stopId: s.id, name: s.name, reason: "coincides-with-origin" });
      continue;
    }
    if (destination && haversineKm(loc, destination) < 1) {
      ignored.push({ stopId: s.id, name: s.name, reason: "coincides-with-destination" });
      continue;
    }

    viaPoints.push({ loc, name: s.name, stopId: s.id });
  }

  return { origin, destination, viaPoints, detours, suggestions, ignored };
}

/**
 * Build the ordered waypoint list for getRoute(): origin → via-points → destination.
 * Returns null if either endpoint is missing.
 */
export function buildTripWaypoints(
  trip: Trip,
  days: TripDay[],
  stops: Stop[],
): {
  origin: LatLng;
  destination: LatLng;
  viaPoints: RouteWaypointInfo[];
  hash: string;
  classification: TripRouteClassification;
} | null {
  const classification = classifyRouteStops(trip, days, stops);
  const { origin, destination, viaPoints } = classification;
  if (!origin || !destination) return null;
  const all: LatLng[] = [origin, ...viaPoints.map((v) => v.loc), destination];
  return { origin, destination, viaPoints, hash: waypointHash(all), classification };
}

/** In-flight recalc dedupe so rapid-fire mutations don't stack ORS calls. */
const inflight = new Map<string, Promise<RecalcResult>>();

/**
 * Recalculate the main route for a trip and persist the result.
 *
 * This is the ONLY function in the app allowed to write
 * `routeGeometry / routeDistanceKm / routeDurationMin / routeProvider /
 * routeWaypointsHash` on a trip (apart from the wizard's initial creation
 * and EditTripSheet clearing them when endpoints change).
 */
export async function recalculateTripRoute(
  tripId: string,
  reason: RecalcReason = "manual",
): Promise<RecalcResult> {
  const existing = inflight.get(tripId);
  if (existing) return existing;

  const run = (async (): Promise<RecalcResult> => {
    const bundle = tripsApi.getTripBundle(tripId);
    if (!bundle.trip) {
      const r: RecalcResult = { success: false, status: "error", waypointCount: 0, waypointNames: [], error: "trip-not-found", reason };
      writeDebug(r);
      return r;
    }
    const plan = buildTripWaypoints(bundle.trip, bundle.days, bundle.stops);
    if (!plan) {
      const r: RecalcResult = { success: false, status: "no-endpoints", waypointCount: 0, waypointNames: [], reason };
      writeDebug(r, 0);
      return r;
    }
    const waypointNames = ["origin", ...plan.viaPoints.map((v) => v.name), "destination"];

    // Cache hit: same waypoints as last persisted result.
    if (plan.hash === bundle.trip.routeWaypointsHash
      && bundle.trip.routeGeometry
      && bundle.trip.routeGeometry.length > 1) {
      const r: RecalcResult = {
        success: true,
        status: "skipped",
        provider: bundle.trip.routeProvider,
        waypointCount: plan.viaPoints.length + 2,
        waypointNames,
        hash: plan.hash,
        reason,
      };
      writeDebug(r, bundle.trip.routeGeometry.length);
      return r;
    }

    let res: RouteResult | null = null;
    try {
      res = await getRoute({
        origin: plan.origin,
        destination: plan.destination,
        waypoints: plan.viaPoints.map((v) => v.loc),
        routeStyle: bundle.trip.style === "fastest" ? "fastest" : "scenic",
      });
    } catch (err) {
      const r: RecalcResult = {
        success: false, status: "error",
        waypointCount: plan.viaPoints.length + 2, waypointNames, hash: plan.hash, reason,
        error: (err as Error)?.message ?? "getRoute-threw",
      };
      writeDebug(r);
      return r;
    }
    if (!res || res.geometry.length < 2) {
      const r: RecalcResult = {
        success: false, status: "error",
        waypointCount: plan.viaPoints.length + 2, waypointNames, hash: plan.hash, reason,
        error: "no-route",
      };
      writeDebug(r);
      return r;
    }

    try {
      tripsApi.updateTrip(tripId, {
        routeGeometry: res.geometry,
        routeDistanceKm: res.distanceKm,
        routeDurationMin: res.durationMin,
        routeWaypointsHash: plan.hash,
        routeProvider: res.provider,
        distanceKm: Math.round(res.distanceKm),
        drivingTime: formatDrivingTime(res.durationMin),
      });
    } catch (err) {
      const r: RecalcResult = {
        success: false, status: "error",
        waypointCount: plan.viaPoints.length + 2, waypointNames, hash: plan.hash, reason,
        error: `persist-failed: ${(err as Error)?.message ?? "unknown"}`,
      };
      writeDebug(r, res.geometry.length);
      return r;
    }

    const r: RecalcResult = {
      success: true, status: "ok",
      provider: res.provider,
      waypointCount: plan.viaPoints.length + 2,
      waypointNames, hash: plan.hash, reason,
      warnings: res.warnings,
    };
    writeDebug(r, res.geometry.length);
    return r;
  })();

  inflight.set(tripId, run);
  try {
    return await run;
  } finally {
    inflight.delete(tripId);
  }
}

function writeDebug(r: RecalcResult, geometryPoints?: number) {
  lastDebug = {
    ts: new Date().toISOString(),
    reason: r.reason,
    status: r.status,
    provider: r.provider,
    waypointCount: r.waypointCount,
    waypointNames: r.waypointNames,
    hash: r.hash,
    geometryPoints,
    error: r.error,
  };
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__veiglede_route_debug = lastDebug;
  }
  // eslint-disable-next-line no-console
  console.info("[veiglede] route recalc", lastDebug);
  notify();
}
