// OpenRouteService adapter — routing + geocoding.
// Only used when VITE_OPENROUTESERVICE_API_KEY is configured.
// All network calls are best-effort; callers must handle null returns and
// fall back to the SVG / interpolated geometry.

import type { GeocodeResult, GeocodingService, RouteResult, RouteWaypoint, RoutingService } from "../types";
import { mapConfig } from "../config";

const ORS_BASE = "https://api.openrouteservice.org";

function hashWaypoints(wps: RouteWaypoint[]): string {
  return wps.map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`).join("|");
}

export const orsRouting: RoutingService = {
  id: "openrouteservice",
  get available() { return Boolean(mapConfig.openrouteserviceKey); },

  async route(waypoints, opts) {
    const key = mapConfig.openrouteserviceKey;
    if (!key || waypoints.length < 2) return null;

    const profile = opts?.profile ?? "driving-car";
    try {
      const coordinates = waypoints.map((w) => [w.lng, w.lat] as [number, number]);
      const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: key,
        },
        body: JSON.stringify({
          coordinates,
          radiuses: coordinates.map(() => -1),
          instructions: false,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const feat = data?.features?.[0];
      if (!feat) return null;
      const coords: [number, number][] = feat.geometry?.coordinates ?? [];
      const summary = feat.properties?.summary ?? {};
      return {
        geometry: coords.map(([lng, lat]) => ({ lat, lng })),
        distanceKm: summary.distance ? Math.round(summary.distance / 100) / 10 : 0,
        durationMin: summary.duration ? Math.round(summary.duration / 60) : 0,
        waypointsHash: hashWaypoints(waypoints),
        provider: "openrouteservice",
      } satisfies RouteResult;
    } catch {
      return null;
    }
  },
};

export const orsGeocoding: GeocodingService = {
  id: "openrouteservice",
  get available() { return Boolean(mapConfig.openrouteserviceKey); },

  async geocode(query) {
    const key = mapConfig.openrouteserviceKey;
    if (!key || !query.trim()) return null;
    try {
      const url = new URL(`${ORS_BASE}/geocode/search`);
      url.searchParams.set("api_key", key);
      url.searchParams.set("text", query);
      url.searchParams.set("size", "1");
      // Bias to Norway when possible — Veiglede is Norway-first.
      url.searchParams.set("boundary.country", "NOR");
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      const data = await res.json();
      const feat = data?.features?.[0];
      if (!feat) return null;
      const [lng, lat] = feat.geometry?.coordinates ?? [];
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return {
        loc: { lat, lng },
        label: feat.properties?.label ?? query,
        provider: "openrouteservice",
      } satisfies GeocodeResult;
    } catch {
      return null;
    }
  },
};
