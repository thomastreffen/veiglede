// Routing v1 — clean abstraction over server-side routing endpoint.
// Always returns a usable RouteResult; falls back to a straight-line demo
// geometry if the server endpoint or upstream provider fails.

import type { LatLng } from "@/lib/geo";
import type { RouteStyle, VehicleType } from "@/lib/trips-store";

export interface GetRouteInput {
  origin: LatLng;
  destination: LatLng;
  vehicleType?: VehicleType;
  routeStyle?: RouteStyle;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: LatLng[];
  provider: "ors" | "demo" | "fallback";
  warnings?: string[];
}

// Haversine distance in km
function distKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function interpolateGeometry(a: LatLng, b: LatLng, steps = 24): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return pts;
}

export function fallbackRoute(input: GetRouteInput, warning?: string): RouteResult {
  const km = Math.round(distKm(input.origin, input.destination) * 1.25); // road factor
  const speedKmh = input.routeStyle === "fastest" ? 75 : 60;
  return {
    distanceKm: km,
    durationMin: Math.round((km / speedKmh) * 60),
    geometry: interpolateGeometry(input.origin, input.destination, 32),
    provider: "fallback",
    warnings: warning ? [warning] : undefined,
  };
}

export async function getRoute(input: GetRouteInput): Promise<RouteResult> {
  if (typeof fetch === "undefined") return fallbackRoute(input, "no-fetch");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch("/api/public/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return fallbackRoute(input, `http-${res.status}`);
    }
    const data = (await res.json()) as Partial<RouteResult> & { error?: string };
    if (
      !data ||
      !Array.isArray(data.geometry) ||
      data.geometry.length < 2 ||
      typeof data.distanceKm !== "number" ||
      typeof data.durationMin !== "number"
    ) {
      return fallbackRoute(input, data?.error ?? "bad-response");
    }
    return {
      distanceKm: data.distanceKm,
      durationMin: data.durationMin,
      geometry: data.geometry,
      provider: (data.provider as RouteResult["provider"]) ?? "fallback",
      warnings: data.warnings,
    };
  } catch (err) {
    return fallbackRoute(input, `error-${(err as Error)?.name ?? "unknown"}`);
  }
}
