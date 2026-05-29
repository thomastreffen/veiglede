// Lightweight geo helpers for the SVG map MVP.
// We store hand-picked coordinates for the places that appear in the demo trips
// and the route-suggestion pool. For anything not in the lookup we interpolate
// linearly between origin and destination so the map still feels ordered.

import type { Stop, Trip, TripDay, SuggestedStop } from "./trips-store";

export interface LatLng { lat: number; lng: number }

export const DETOUR_THRESHOLD_KM = 12;

// Approximate coordinates for places referenced in seed data + suggestions.
// Norwegian projection — no claim to surveyor accuracy, just believable.
const PLACES: Record<string, LatLng> = {
  // East
  oslo: { lat: 59.913, lng: 10.752 },
  drammen: { lat: 59.744, lng: 10.204 },
  kongsberg: { lat: 59.665, lng: 9.652 },
  lillehammer: { lat: 61.115, lng: 10.466 },
  // Numedal / Hardanger
  nore: { lat: 60.182, lng: 8.997 },
  uvdal: { lat: 60.293, lng: 8.781 },
  geilo: { lat: 60.531, lng: 8.207 },
  hardangervidda: { lat: 60.300, lng: 7.700 },
  dyranut: { lat: 60.418, lng: 7.563 },
  eidfjord: { lat: 60.466, lng: 7.073 },
  // Vestlandet
  bergen: { lat: 60.391, lng: 5.322 },
  stalheim: { lat: 60.864, lng: 6.660 },
  voss: { lat: 60.629, lng: 6.413 },
  flåm: { lat: 60.863, lng: 7.114 },
  flam: { lat: 60.863, lng: 7.114 },
  aurland: { lat: 60.906, lng: 7.193 },
  undredal: { lat: 60.934, lng: 7.107 },
  balestrand: { lat: 61.207, lng: 6.534 },
  jostedalen: { lat: 61.572, lng: 7.295 },
  gaularfjellet: { lat: 61.295, lng: 6.139 },
  stadlandet: { lat: 62.181, lng: 5.106 },
  // Romsdalen / Sunnmøre
  bjorli: { lat: 62.265, lng: 8.205 },
  romsdalen: { lat: 62.499, lng: 7.776 },
  molde: { lat: 62.738, lng: 7.161 },
  åndalsnes: { lat: 62.567, lng: 7.689 },
  andalsnes: { lat: 62.567, lng: 7.689 },
  ålesund: { lat: 62.472, lng: 6.149 },
  alesund: { lat: 62.472, lng: 6.149 },
  geiranger: { lat: 62.103, lng: 7.207 },
  // Indre fjell
  beitostølen: { lat: 61.250, lng: 8.901 },
  beitostolen: { lat: 61.250, lng: 8.901 },
  valdresflye: { lat: 61.420, lng: 8.853 },
  sognefjellet: { lat: 61.572, lng: 7.999 },
  lom: { lat: 61.840, lng: 8.567 },
  vågåmo: { lat: 61.876, lng: 9.094 },
  vagamo: { lat: 61.876, lng: 9.094 },
  // Dovre
  dovrefjell: { lat: 62.255, lng: 9.539 },
  hjerkinn: { lat: 62.226, lng: 9.547 },
  dombås: { lat: 62.075, lng: 9.127 },
  dombas: { lat: 62.075, lng: 9.127 },
  trondheim: { lat: 63.430, lng: 10.395 },
  // Lofoten / Nord
  svolvær: { lat: 68.234, lng: 14.567 },
  svolvaer: { lat: 68.234, lng: 14.567 },
  henningsvær: { lat: 68.156, lng: 14.205 },
  henningsvaer: { lat: 68.156, lng: 14.205 },
  hamnøy: { lat: 67.937, lng: 13.118 },
  hamnoy: { lat: 67.937, lng: 13.118 },
  reine: { lat: 67.932, lng: 13.090 },
  fredvang: { lat: 68.080, lng: 13.220 },
  å: { lat: 67.879, lng: 12.978 },
  a: { lat: 67.879, lng: 12.978 },
  senja: { lat: 69.300, lng: 17.300 },
  lofoten: { lat: 68.100, lng: 13.700 },
  "fjell-norge": { lat: 61.500, lng: 8.500 },
};

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "");
}

export function lookupPlace(name?: string): LatLng | undefined {
  if (!name) return undefined;
  const key = norm(name);
  if (PLACES[key]) return PLACES[key];
  // Try first word (e.g. "Aurland charging hub" → "aurland")
  const first = norm(name.split(/[\s,]/)[0] ?? "");
  if (first && PLACES[first]) return PLACES[first];
  // Try last word
  const parts = name.split(/[\s,]+/);
  const last = norm(parts[parts.length - 1] ?? "");
  if (last && PLACES[last]) return PLACES[last];
  return undefined;
}

function interp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function explicitStopLoc(stop: Pick<Stop, "lat" | "lng">): LatLng | undefined {
  if (typeof stop.lat === "number" && typeof stop.lng === "number") {
    return { lat: stop.lat, lng: stop.lng };
  }
  return undefined;
}

function projectKm(point: LatLng, refLat: number) {
  const cosLat = Math.cos((refLat * Math.PI) / 180);
  return {
    x: point.lng * 111.32 * cosLat,
    y: point.lat * 110.574,
  };
}

function pointToSegmentKm(point: LatLng, a: LatLng, b: LatLng): number {
  if (a.lat === b.lat && a.lng === b.lng) return distanceKm(point, a);
  const refLat = (point.lat + a.lat + b.lat) / 3;
  const p = projectKm(point, refLat);
  const p1 = projectKm(a, refLat);
  const p2 = projectKm(b, refLat);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
  const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq));
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export interface MappedStop {
  stop: Stop;
  day: TripDay;
  dayIndex: number;
  globalIndex: number;
  loc: LatLng;
  approximated: boolean;
}

/** Returns origin, destination, and stops projected with coordinates. */
export function projectTrip(
  trip: Trip,
  days: TripDay[],
  stops: Stop[],
): { origin: LatLng; destination: LatLng; mapped: MappedStop[]; originName: string; destinationName: string } {
  const origin = trip.originLoc ?? lookupPlace(trip.origin) ?? { lat: 60.0, lng: 9.0 };
  const destination = trip.destinationLoc ?? lookupPlace(trip.destination) ?? { lat: 62.0, lng: 9.0 };
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  // Build flat ordered list of stops by day then stop.order
  const flat: { stop: Stop; day: TripDay; dayIndex: number }[] = [];
  sortedDays.forEach((day, dayIndex) => {
    const dayStops = stops
      .filter((s) => s.dayId === day.id)
      .sort((a, b) => a.order - b.order);
    dayStops.forEach((stop) => flat.push({ stop, day, dayIndex }));
  });

  // If we have a real route geometry, place approximated stops along the
  // actual route corridor (proportional t along the polyline) so they don't
  // cluster on a straight line between origin and destination.
  const geom = trip.routeGeometry && trip.routeGeometry.length > 1 ? trip.routeGeometry : null;
  const pickAlongGeom = (t: number): LatLng => {
    if (!geom) return interp(origin, destination, t);
    const idx = Math.min(geom.length - 1, Math.max(0, Math.round(t * (geom.length - 1))));
    return geom[idx];
  };

  const total = flat.length;
  const mapped: MappedStop[] = flat.map((entry, globalIndex) => {
    const looked = explicitStopLoc(entry.stop) ?? lookupPlace(entry.stop.location ?? entry.stop.name);
    // Distribute unknown stops evenly along the route corridor
    const t = total > 0 ? (globalIndex + 1) / (total + 1) : 0.5;
    const fallback = pickAlongGeom(t);
    return {
      ...entry,
      globalIndex,
      loc: looked ?? fallback,
      approximated: !looked,
    };
  });

  return {
    origin,
    destination,
    mapped,
    originName: trip.origin,
    destinationName: trip.destination,
  };
}

/** Distance in km between two lat/lng (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Shortest distance from a point to the polyline of route stops. */
export function distanceToRoute(point: LatLng, routePoints: LatLng[]): number {
  if (routePoints.length === 0) return 0;
  if (routePoints.length === 1) return distanceKm(point, routePoints[0]);
  let min = Infinity;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const d = pointToSegmentKm(point, routePoints[i], routePoints[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

export interface RouteBBox { minLng: number; minLat: number; maxLng: number; maxLat: number }

/** Bounding box of a route polyline expanded by `bufferDeg` (≈111km/° lat). */
export function routeBoundingBox(routePoints: LatLng[], bufferDeg = 0.5): RouteBBox | null {
  if (!routePoints || routePoints.length === 0) return null;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of routePoints) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return {
    minLng: minLng - bufferDeg,
    maxLng: maxLng + bufferDeg,
    minLat: minLat - bufferDeg,
    maxLat: maxLat + bufferDeg,
  };
}

export function isInsideBBox(loc: LatLng, bbox: RouteBBox): boolean {
  return loc.lng >= bbox.minLng && loc.lng <= bbox.maxLng && loc.lat >= bbox.minLat && loc.lat <= bbox.maxLat;
}

/** Midpoint of a polyline (by index) and approx length in km. */
export function routeMidpointAndLengthKm(routePoints: LatLng[]): { mid: LatLng; lengthKm: number } | null {
  if (!routePoints || routePoints.length === 0) return null;
  if (routePoints.length === 1) return { mid: routePoints[0], lengthKm: 0 };
  let lengthKm = 0;
  for (let i = 0; i < routePoints.length - 1; i++) {
    lengthKm += distanceKm(routePoints[i], routePoints[i + 1]);
  }
  const mid = routePoints[Math.floor(routePoints.length / 2)];
  return { mid, lengthKm };
}

/** Nearest point on the polyline to `point` — used to anchor detour spurs. */
export function nearestPointOnRoute(point: LatLng, routePoints: LatLng[]): LatLng | null {
  if (routePoints.length === 0) return null;
  if (routePoints.length === 1) return routePoints[0];
  let best: { loc: LatLng; d: number } | null = null;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const refLat = (point.lat + a.lat + b.lat) / 3;
    const p = projectKm(point, refLat);
    const p1 = projectKm(a, refLat);
    const p2 = projectKm(b, refLat);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq));
    const loc: LatLng = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    const d = distanceKm(point, loc);
    if (!best || d < best.d) best = { loc, d };
  }
  return best ? best.loc : null;
}


/** Estimate detour minutes from km off-route (rough 60km/h average). */
export function detourMinutes(extraKm: number): number {
  return Math.max(2, Math.round((extraKm * 2) / (60 / 60))); // 2× because round trip
}

/** Returns route metadata for a suggestion: how far off the route it sits. */
export function suggestionRouteInfo(
  sug: SuggestedStop,
  routePoints: LatLng[],
): { off: boolean; distanceFromRouteKm: number; extraDistanceKm: number; detourMin: number; loc?: LatLng } {
  const loc = (typeof sug.lat === "number" && typeof sug.lng === "number")
    ? { lat: sug.lat, lng: sug.lng }
    : lookupPlace(sug.location ?? sug.name);
  if (!loc || routePoints.length === 0) {
    return { off: false, distanceFromRouteKm: 0, extraDistanceKm: 0, detourMin: 5, loc };
  }
  const d = distanceToRoute(loc, routePoints);
  const extraDistanceKm = Math.round(d * 2 * 10) / 10;
  return {
    off: d > DETOUR_THRESHOLD_KM,
    distanceFromRouteKm: Math.round(d * 10) / 10,
    extraDistanceKm,
    detourMin: detourMinutes(d),
    loc,
  };
}
