// Public entry point for the provider-agnostic map layer.
//
// Anything outside src/lib/map should import from here only — never from a
// specific provider file or vendor SDK. This is what lets us swap MapTiler
// or OpenRouteService later without touching the rest of the app.

import type { GeocodingService, MapRendererCapabilities, PlacesService, RouteResult, RouteWaypoint, RoutingService } from "./types";
import { mapConfig } from "./config";
import { orsGeocoding, orsRouting } from "./providers/openrouteservice";
import { noopGeocoding, noopPlaces, noopRouting } from "./providers/fallback";

export { mapConfig, getMaptilerStyleUrl } from "./config";
export type { LatLng } from "@/lib/geo";
export type {
  GeocodeResult,
  GeocodingService,
  MapRendererCapabilities,
  PlacesService,
  RouteResult,
  RouteWaypoint,
  RoutingService,
} from "./types";

export function getRoutingService(): RoutingService {
  return mapConfig.hasRouting ? orsRouting : noopRouting;
}

export function getGeocodingService(): GeocodingService {
  return mapConfig.hasGeocoding ? orsGeocoding : noopGeocoding;
}

export function getPlacesService(): PlacesService {
  // No live places provider yet — reserved for a future upgrade
  // (e.g. Overpass / Foursquare / Google Places).
  return noopPlaces;
}

export function getCapabilities(): MapRendererCapabilities {
  return {
    realMap: mapConfig.hasRealMap,
    routing: mapConfig.hasRouting,
    geocoding: mapConfig.hasGeocoding,
  };
}

// --- Route caching ---------------------------------------------------------
// Cached in-memory + localStorage so re-opening a planner doesn't re-bill ORS.

const MEMO: Map<string, RouteResult> = new Map();
const LS_KEY = "veiglede.map.routeCache.v1";

function loadDisk(): Record<string, RouteResult> {
  if (typeof localStorage === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}
function saveDisk(map: Record<string, RouteResult>) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch { /* quota — ignore */ }
}

function waypointKey(wps: RouteWaypoint[]): string {
  return wps.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join("|");
}

export async function getCachedRoute(wps: RouteWaypoint[]): Promise<RouteResult | null> {
  if (wps.length < 2) return null;
  const key = waypointKey(wps);
  if (MEMO.has(key)) return MEMO.get(key)!;
  const disk = loadDisk();
  if (disk[key]) { MEMO.set(key, disk[key]); return disk[key]; }

  const result = await getRoutingService().route(wps);
  if (result) {
    MEMO.set(key, result);
    disk[key] = result;
    saveDisk(disk);
  }
  return result;
}
