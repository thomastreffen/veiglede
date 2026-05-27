// Provider-agnostic map service interfaces.
// Concrete implementations live under src/lib/map/providers/*.
// The app should always depend on these types, never on a vendor SDK directly.

import type { LatLng } from "@/lib/geo";

export interface RouteWaypoint { lat: number; lng: number; name?: string }

export interface RouteResult {
  /** Decoded polyline as ordered lat/lng points. */
  geometry: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** Hash of the input waypoints — used as a cache key. */
  waypointsHash: string;
  /** Provider id, for debugging. */
  provider: string;
}

export interface GeocodeResult {
  loc: LatLng;
  label: string;
  provider: string;
}

export interface RoutingService {
  id: string;
  available: boolean;
  /** Calculate a driving route between two or more waypoints. */
  route(waypoints: RouteWaypoint[], opts?: { profile?: "driving-car" | "driving-hgv" | "cycling-regular" }): Promise<RouteResult | null>;
}

export interface GeocodingService {
  id: string;
  available: boolean;
  /** Resolve a free-text place name to coordinates. Returns null on miss. */
  geocode(query: string): Promise<GeocodeResult | null>;
}

export interface PlacesService {
  id: string;
  available: boolean;
  /** Placeholder for future POI / "places near route" lookups. */
  nearby?(loc: LatLng, opts?: { radiusKm?: number; categories?: string[] }): Promise<unknown>;
}

export interface MapRendererCapabilities {
  /** Real tile-based map renderer is available. */
  realMap: boolean;
  /** A routing provider is configured. */
  routing: boolean;
  /** A geocoding provider is configured. */
  geocoding: boolean;
}
