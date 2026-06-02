// Place autocomplete service — Google Places API (New) via server proxy.
//
// All POI / place / address search uses Google Places, server-proxied through
// /api/public/google-places (which routes via the Lovable Google Maps
// connector gateway). MapTiler / Mapbox / Foursquare are no longer used for
// search. MapTiler is still used elsewhere for reverse geocoding ("Bruk min
// posisjon") and Mapbox for routing — those are not in this file.
//
// Google autocomplete only returns place_ids — coordinates are fetched on
// selection via a separate Place Details call (`resolveGooglePlace`).

export type PlaceType = "city" | "address" | "poi" | "region" | "unknown";
export type PlaceSource = "google" | "demo" | "manual";

export interface ResolvedPlace {
  id: string;
  label: string;
  name: string;
  secondary?: string;
  lat: number;
  lng: number;
  type: PlaceType;
  country?: string;
  source: PlaceSource;
  /** True when this entry is from autocomplete and needs a Place Details
   * lookup to populate lat/lng before it can be used for routing. */
  needsDetails?: boolean;
  /** Raw Google Places types (e.g. "lodging", "campground"). Used by the
   * trip planner to auto-classify lodging stops without keyword guessing. */
  placeTypes?: string[];
}

// Small curated fallback for offline / "Use anyway" support.
interface DemoEntry { name: string; secondary: string; type: PlaceType; lat: number; lng: number; aliases?: string[] }
const DEMO_PLACES: DemoEntry[] = [
  { name: "Oslo", secondary: "Oslo, Norge", type: "city", lat: 59.913, lng: 10.752 },
  { name: "Bergen", secondary: "Vestland, Norge", type: "city", lat: 60.391, lng: 5.322 },
  { name: "Trondheim", secondary: "Trøndelag, Norge", type: "city", lat: 63.430, lng: 10.395 },
  { name: "Stavanger", secondary: "Rogaland, Norge", type: "city", lat: 58.970, lng: 5.731 },
  { name: "Kristiansand", secondary: "Agder, Norge", type: "city", lat: 58.146, lng: 7.995 },
  { name: "Tromsø", secondary: "Troms, Norge", type: "city", lat: 69.649, lng: 18.956, aliases: ["tromso"] },
  { name: "Lillehammer", secondary: "Innlandet, Norge", type: "city", lat: 61.115, lng: 10.466 },
  { name: "Geilo", secondary: "Buskerud, Norge", type: "city", lat: 60.531, lng: 8.207 },
  { name: "Flåm", secondary: "Vestland, Norge", type: "city", lat: 60.863, lng: 7.114, aliases: ["flam"] },
];
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function searchDemoPlaces(q: string, limit = 6): ResolvedPlace[] {
  const n = norm(q);
  if (!n) return [];
  const out: DemoEntry[] = [];
  for (const p of DEMO_PLACES) {
    const cands = [norm(p.name), ...(p.aliases ?? [])];
    if (cands.some((c) => c.startsWith(n) || c.includes(n))) out.push(p);
  }
  return out.slice(0, limit).map((p, i) => ({
    id: `demo-${norm(p.name)}-${i}`,
    label: `${p.name}, ${p.secondary}`,
    name: p.name,
    secondary: p.secondary,
    lat: p.lat, lng: p.lng,
    type: p.type, country: "no", source: "demo",
  }));
}

export interface SearchOptions {
  /** Semantic category — restricts Google place types. */
  category?: "fuel" | "charging" | "lodging";
  /** Optional brand/keyword prefix prepended to the user's text. */
  queryPrefix?: string;
  /** Proximity bias (e.g. trip route midpoint). */
  proximity?: { lng: number; lat: number };
}

interface GoogleAutocompleteResult {
  id: string; name: string; address: string; types: string[];
}

async function searchGoogle(q: string, signal: AbortSignal, opts: SearchOptions): Promise<ResolvedPlace[]> {
  const params = new URLSearchParams({ action: "autocomplete", input: q });
  if (opts.category) params.set("category", opts.category);
  if (opts.proximity) {
    params.set("lng", String(opts.proximity.lng));
    params.set("lat", String(opts.proximity.lat));
  }
  const res = await fetch(`/api/public/google-places?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as { results?: GoogleAutocompleteResult[] };
  const items = data.results ?? [];
  return items.map((r): ResolvedPlace => ({
    id: `g-${r.id}`,
    label: r.address ? `${r.name}, ${r.address}` : r.name,
    name: r.name,
    secondary: r.address || undefined,
    lat: 0, lng: 0,
    type: pickType(r.types),
    source: "google",
    needsDetails: true,
    placeTypes: r.types ?? [],
  }));
}

function pickType(types: string[]): PlaceType {
  if (!types?.length) return "unknown";
  if (types.some((t) => t === "locality" || t === "postal_town" || t === "administrative_area_level_3")) return "city";
  if (types.some((t) => t === "street_address" || t === "route" || t === "premise")) return "address";
  if (types.some((t) => t === "administrative_area_level_1" || t === "administrative_area_level_2" || t === "country")) return "region";
  return "poi";
}

/** Fetch Place Details for a Google place, returning a fully-resolved place
 * with lat/lng. Returns null on failure. */
export async function resolveGooglePlace(place: ResolvedPlace): Promise<ResolvedPlace | null> {
  if (!place.needsDetails) return place;
  const rawId = place.id.startsWith("g-") ? place.id.slice(2) : place.id;
  try {
    const res = await fetch(`/api/public/google-places?action=details&placeId=${encodeURIComponent(rawId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { place?: { id: string; name: string; address: string; lat: number; lng: number; types?: string[] } };
    const p = data.place;
    if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    return {
      ...place,
      lat: p.lat,
      lng: p.lng,
      name: p.name || place.name,
      secondary: p.address || place.secondary,
      label: p.address ? `${p.name || place.name}, ${p.address}` : (place.label || p.name || place.name),
      type: pickType(p.types ?? []),
      placeTypes: p.types ?? place.placeTypes ?? [],
      needsDetails: false,
    };
  } catch {
    return null;
  }
}

export interface SearchResult {
  results: ResolvedPlace[];
  provider: PlaceSource;
  failed: boolean;
}

export async function searchPlaces(q: string, signal?: AbortSignal, options: SearchOptions = {}): Promise<SearchResult> {
  const raw = q.trim();
  if (raw.length < 2) return { results: [], provider: "demo", failed: false };
  const query = options.queryPrefix ? `${options.queryPrefix} ${raw}` : raw;

  const ctrl = signal ? undefined : new AbortController();
  const sig = signal ?? ctrl!.signal;
  const timeout = setTimeout(() => ctrl?.abort(), 5000);

  try {
    const results = await searchGoogle(query, sig, options);
    clearTimeout(timeout);
    console.log(`Google Places: ${results.length} results for "${query}"`);
    return { results, provider: "google", failed: false };
  } catch (err) {
    clearTimeout(timeout);
    if ((err as { name?: string })?.name === "AbortError") {
      return { results: [], provider: "demo", failed: true };
    }
    console.log(`Google Places: error for "${query}"`, err);
    return { results: [], provider: "demo", failed: true };
  }
}

export function manualPlace(text: string): ResolvedPlace | null {
  const t = text.trim();
  if (!t) return null;
  const demo = searchDemoPlaces(t, 1)[0];
  if (demo) return { ...demo, source: "manual" };
  return null;
}
