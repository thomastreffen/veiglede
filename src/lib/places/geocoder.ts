// Place autocomplete service.
//
// Primary provider: MapTiler Geocoding API (Norway-first).
// Fallback: a small local catalogue of well-known Norwegian places used by
// the demo data so the wizard keeps working when MapTiler is offline or
// no key is configured. The fallback also matches when the API returns no
// results so users typing "Hardangervidda" or "Trollstigen" always see
// something useful.
//
// Returns an empty list rather than throwing — never block the wizard.

import { getRuntimeMapConfig } from "@/lib/map/runtime-config";

export type PlaceType = "city" | "address" | "poi" | "region" | "unknown";
export type PlaceSource = "maptiler" | "demo" | "manual";

export interface ResolvedPlace {
  id: string;
  label: string;        // full display label "Drammen, Buskerud, Norge"
  name: string;         // primary name "Drammen"
  secondary?: string;   // "Buskerud, Norge"
  lat: number;
  lng: number;
  type: PlaceType;
  country?: string;
  source: PlaceSource;
}

// Small curated catalogue used as the offline / fallback provider.
// Mirrors the demo coordinates in src/lib/geo.ts but with friendly labels.
interface DemoEntry { name: string; secondary: string; type: PlaceType; lat: number; lng: number; aliases?: string[] }

const DEMO_PLACES: DemoEntry[] = [
  { name: "Oslo", secondary: "Oslo, Norge", type: "city", lat: 59.913, lng: 10.752 },
  { name: "Drammen", secondary: "Buskerud, Norge", type: "city", lat: 59.744, lng: 10.204 },
  { name: "Kongsberg", secondary: "Buskerud, Norge", type: "city", lat: 59.665, lng: 9.652 },
  { name: "Lillehammer", secondary: "Innlandet, Norge", type: "city", lat: 61.115, lng: 10.466 },
  { name: "Geilo", secondary: "Buskerud, Norge", type: "city", lat: 60.531, lng: 8.207 },
  { name: "Hardangervidda", secondary: "Nasjonalpark, Norge", type: "region", lat: 60.300, lng: 7.700 },
  { name: "Eidfjord", secondary: "Vestland, Norge", type: "city", lat: 60.466, lng: 7.073 },
  { name: "Bergen", secondary: "Vestland, Norge", type: "city", lat: 60.391, lng: 5.322 },
  { name: "Voss", secondary: "Vestland, Norge", type: "city", lat: 60.629, lng: 6.413 },
  { name: "Flåm", secondary: "Vestland, Norge", type: "city", lat: 60.863, lng: 7.114, aliases: ["flam"] },
  { name: "Aurland", secondary: "Vestland, Norge", type: "city", lat: 60.906, lng: 7.193 },
  { name: "Stalheim", secondary: "Vestland, Norge", type: "poi", lat: 60.864, lng: 6.660 },
  { name: "Balestrand", secondary: "Vestland, Norge", type: "city", lat: 61.207, lng: 6.534 },
  { name: "Molde", secondary: "Møre og Romsdal, Norge", type: "city", lat: 62.738, lng: 7.161 },
  { name: "Åndalsnes", secondary: "Møre og Romsdal, Norge", type: "city", lat: 62.567, lng: 7.689, aliases: ["andalsnes"] },
  { name: "Ålesund", secondary: "Møre og Romsdal, Norge", type: "city", lat: 62.472, lng: 6.149, aliases: ["alesund"] },
  { name: "Geiranger", secondary: "Møre og Romsdal, Norge", type: "city", lat: 62.103, lng: 7.207 },
  { name: "Trollstigen", secondary: "Nasjonal turistveg, Norge", type: "poi", lat: 62.456, lng: 7.661 },
  { name: "Atlanterhavsveien", secondary: "Nasjonal turistveg, Norge", type: "poi", lat: 63.014, lng: 7.350 },
  { name: "Sognefjellet", secondary: "Nasjonal turistveg, Norge", type: "poi", lat: 61.572, lng: 7.999 },
  { name: "Lom", secondary: "Innlandet, Norge", type: "city", lat: 61.840, lng: 8.567 },
  { name: "Beitostølen", secondary: "Innlandet, Norge", type: "city", lat: 61.250, lng: 8.901, aliases: ["beitostolen"] },
  { name: "Dombås", secondary: "Innlandet, Norge", type: "city", lat: 62.075, lng: 9.127, aliases: ["dombas"] },
  { name: "Dovrefjell", secondary: "Nasjonalpark, Norge", type: "region", lat: 62.255, lng: 9.539 },
  { name: "Trondheim", secondary: "Trøndelag, Norge", type: "city", lat: 63.430, lng: 10.395 },
  { name: "Lofoten", secondary: "Nordland, Norge", type: "region", lat: 68.100, lng: 13.700 },
  { name: "Svolvær", secondary: "Nordland, Norge", type: "city", lat: 68.234, lng: 14.567, aliases: ["svolvaer"] },
  { name: "Henningsvær", secondary: "Nordland, Norge", type: "city", lat: 68.156, lng: 14.205, aliases: ["henningsvaer"] },
  { name: "Reine", secondary: "Lofoten, Norge", type: "city", lat: 67.932, lng: 13.090 },
  { name: "Hamnøy", secondary: "Lofoten, Norge", type: "city", lat: 67.937, lng: 13.118, aliases: ["hamnoy"] },
  { name: "Senja", secondary: "Troms, Norge", type: "region", lat: 69.300, lng: 17.300 },
  { name: "Stavanger", secondary: "Rogaland, Norge", type: "city", lat: 58.970, lng: 5.731 },
  { name: "Kristiansand", secondary: "Agder, Norge", type: "city", lat: 58.146, lng: 7.995 },
  { name: "Tromsø", secondary: "Troms, Norge", type: "city", lat: 69.649, lng: 18.956, aliases: ["tromso"] },
  { name: "Bodø", secondary: "Nordland, Norge", type: "city", lat: 67.280, lng: 14.405, aliases: ["bodo"] },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function searchDemoPlaces(q: string, limit = 6): ResolvedPlace[] {
  const n = norm(q);
  if (!n) return [];
  const starts: DemoEntry[] = [];
  const contains: DemoEntry[] = [];
  for (const p of DEMO_PLACES) {
    const candidates = [norm(p.name), ...(p.aliases ?? [])];
    if (candidates.some((c) => c.startsWith(n))) starts.push(p);
    else if (candidates.some((c) => c.includes(n))) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit).map((p, i) => ({
    id: `demo-${norm(p.name)}-${i}`,
    label: `${p.name}, ${p.secondary}`,
    name: p.name,
    secondary: p.secondary,
    lat: p.lat,
    lng: p.lng,
    type: p.type,
    country: "no",
    source: "demo",
  }));
}

// Map MapTiler feature → ResolvedPlace
function mapTilerType(placeType: string[] | undefined): PlaceType {
  if (!placeType || placeType.length === 0) return "unknown";
  const t = placeType[0];
  if (t === "address" || t === "street") return "address";
  if (t === "municipality" || t === "city" || t === "village" || t === "town" || t === "locality" || t === "neighbourhood") return "city";
  if (t === "region" || t === "county" || t === "subregion" || t === "country") return "region";
  if (t === "poi") return "poi";
  return "unknown";
}

interface MapTilerFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number]; // [lng, lat]
  geometry?: { coordinates?: [number, number] };
  context?: { id?: string; text?: string }[];
}

import { MAPTILER_GEOCODING_PARAMS } from "./maptiler-params";

export interface SearchOptions {
  /** MapTiler `types` filter, e.g. "poi", "poi,address". */
  types?: string;
  /** Optional query prefix prepended to user input (e.g. brand keywords for fuel). */
  queryPrefix?: string;
}

async function searchMapTiler(q: string, key: string, signal: AbortSignal, opts: SearchOptions = {}): Promise<ResolvedPlace[]> {
  const params = new URLSearchParams({
    key,
    proximity: MAPTILER_GEOCODING_PARAMS.proximity,
    language: MAPTILER_GEOCODING_PARAMS.language,
    country: MAPTILER_GEOCODING_PARAMS.country,
    limit: String(MAPTILER_GEOCODING_PARAMS.limit),
  });
  if (opts.types) params.set("types", opts.types);
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`maptiler ${res.status}`);
  const data = await res.json() as { features?: MapTilerFeature[] };
  const feats = data.features ?? [];
  return feats.map((f, i): ResolvedPlace | null => {
    const coords = f.center ?? f.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const name = f.text?.trim() || f.place_name?.split(",")[0]?.trim() || q;
    const secondary = (f.place_name ?? "").split(",").slice(1).map((s) => s.trim()).filter(Boolean).join(", ") || (f.context ?? []).map((c) => c.text).filter(Boolean).join(", ");
    return {
      id: `maptiler-${f.id ?? i}`,
      label: f.place_name ?? name,
      name,
      secondary: secondary || undefined,
      lat: coords[1],
      lng: coords[0],
      type: mapTilerType(f.place_type),
      country: (f.context ?? []).find((c) => c.id?.startsWith("country"))?.text?.toLowerCase(),
      source: "maptiler",
    };
  }).filter((x): x is ResolvedPlace => x !== null);
}


export interface SearchResult {
  results: ResolvedPlace[];
  provider: PlaceSource; // which provider produced results
  failed: boolean;       // true if maptiler was tried and errored/timed out
}

export async function searchPlaces(q: string, signal?: AbortSignal, options: SearchOptions = {}): Promise<SearchResult> {
  const raw = q.trim();
  if (raw.length < 2) return { results: [], provider: "demo", failed: false };
  const query = options.queryPrefix ? `${options.queryPrefix} ${raw}` : raw;

  const cfg = await getRuntimeMapConfig();
  const ctrl = signal ? undefined : new AbortController();
  const sig = signal ?? ctrl!.signal;
  const timeout = setTimeout(() => ctrl?.abort(), 4000);

  let failed = false;
  if (cfg.maptilerKey) {
    try {
      const results = await searchMapTiler(query, cfg.maptilerKey, sig, options);
      clearTimeout(timeout);
      if (results.length > 0) return { results, provider: "maptiler", failed: false };
    } catch (err) {
      clearTimeout(timeout);
      if ((err as { name?: string })?.name === "AbortError") {
        return { results: [], provider: "demo", failed: true };
      }
      failed = true;
    }
  }
  clearTimeout(timeout);
  return { results: searchDemoPlaces(raw), provider: "demo", failed };
}

export function manualPlace(text: string): ResolvedPlace | null {
  const t = text.trim();
  if (!t) return null;
  const demo = searchDemoPlaces(t, 1)[0];
  if (demo) return { ...demo, source: "manual" };
  return null;
}
