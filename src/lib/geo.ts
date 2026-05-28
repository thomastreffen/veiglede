// Lightweight geo helpers for the SVG map MVP.
// We store hand-picked coordinates for the places that appear in the demo trips
// and the route-suggestion pool. For anything not in the lookup we interpolate
// linearly between origin and destination so the map still feels ordered.

import type { Stop, Trip, TripDay, SuggestedStop } from "./trips-store";

export interface LatLng { lat: number; lng: number }

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
  const origin = lookupPlace(trip.origin) ?? { lat: 60.0, lng: 9.0 };
  const destination = lookupPlace(trip.destination) ?? { lat: 62.0, lng: 9.0 };
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  // Build flat ordered list of stops by day then stop.order
  const flat: { stop: Stop; day: TripDay; dayIndex: number }[] = [];
  sortedDays.forEach((day, dayIndex) => {
    const dayStops = stops
      .filter((s) => s.dayId === day.id)
      .sort((a, b) => a.order - b.order);
    dayStops.forEach((stop) => flat.push({ stop, day, dayIndex }));
  });

  const total = flat.length;
  const mapped: MappedStop[] = flat.map((entry, globalIndex) => {
    const looked = lookupPlace(entry.stop.location ?? entry.stop.name);
    // Distribute unknown stops evenly between origin and destination
    const t = total > 0 ? (globalIndex + 1) / (total + 1) : 0.5;
    const fallback = interp(origin, destination, t);
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
  // Approximate: minimum distance to any vertex (good enough for demo).
  let min = Infinity;
  for (const p of routePoints) {
    const d = distanceKm(point, p);
    if (d < min) min = d;
  }
  return min;
}

/** Estimate detour minutes from km off-route (rough 60km/h average). */
export function detourMinutes(extraKm: number): number {
  return Math.max(2, Math.round((extraKm * 2) / (60 / 60))); // 2× because round trip
}

/** Returns route metadata for a suggestion: how far off the route it sits. */
export function suggestionRouteInfo(
  sug: SuggestedStop,
  routePoints: LatLng[],
): { off: boolean; distanceFromRouteKm: number; detourMin: number; loc?: LatLng } {
  const loc = lookupPlace(sug.location ?? sug.name);
  if (!loc || routePoints.length === 0) {
    return { off: false, distanceFromRouteKm: 0, detourMin: 5, loc };
  }
  const d = distanceToRoute(loc, routePoints);
  return {
    off: d > 4,
    distanceFromRouteKm: Math.round(d * 10) / 10,
    detourMin: detourMinutes(d),
    loc,
  };
}
