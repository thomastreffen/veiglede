/**
 * Seed road geometry for curated trips.
 *
 * For each trip, POSTs origin → intermediate waypoints → destination to the
 * /api/public/directions endpoint (live preview), receives the decoded
 * polyline, and writes the result to src/lib/curated-geometry.json keyed
 * by slug.
 *
 * Usage:
 *   bun run scripts/seed-curated-geometry.ts [baseUrl]
 *   bun run scripts/seed-curated-geometry.ts https://id-preview--<id>.lovable.app
 */
import { writeFileSync, readFileSync } from "fs";
import { resolve } from "path";

const DEFAULT_BASE = "https://id-preview--87475a04-b786-464d-9515-5abff27287c0.lovable.app";
const baseUrl = (process.argv[2] ?? DEFAULT_BASE).replace(/\/$/, "");
const outPath = resolve(process.cwd(), "src/lib/curated-geometry.json");

// Extract trips from curated-trips.ts by reading the source. We can't import
// it (image assets), so parse a minimal shape.
const src = readFileSync(resolve(process.cwd(), "src/lib/curated-trips.ts"), "utf8");

// Quick & dirty parser: pull `slug: "..."` + `originLoc: {...}` + `destinationLoc: {...}` + day stop lat/lng arrays per trip.
type Pt = { lat: number; lng: number };
type Trip = { slug: string; style?: string; vehicle?: string; origin: Pt; destination: Pt; waypoints: Pt[] };

function parseTrips(): Trip[] {
  const trips: Trip[] = [];
  // Split on `id: t(` (each trip starts with this), skip first chunk (before first trip).
  const chunks = src.split(/\n\s*\{\s*\n\s*id:\s*t\(/).slice(1);
  for (const raw of chunks) {
    const slugMatch = raw.match(/slug:\s*"([^"]+)"/);
    const originMatch = raw.match(/originLoc:\s*\{\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\s*\}/);
    const destMatch = raw.match(/destinationLoc:\s*\{\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\s*\}/);
    const styleMatch = raw.match(/style:\s*"([^"]+)"/);
    const vehMatch = raw.match(/vehicleSuitability:\s*\[\s*"([^"]+)"/);
    if (!slugMatch || !originMatch || !destMatch) continue;
    const slug = slugMatch[1];
    const origin = { lat: parseFloat(originMatch[1]), lng: parseFloat(originMatch[2]) };
    const destination = { lat: parseFloat(destMatch[1]), lng: parseFloat(destMatch[2]) };

    // Cut off at start of next trip (rough but works because trips are sequential).
    const tripBody = raw.split(/\n\s*\{\s*\n\s*id:\s*t\(/)[0];
    // Match all stop lat/lng pairs inside.
    const stopRe = /lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)/g;
    const allPoints: Pt[] = [];
    let m: RegExpExecArray | null;
    while ((m = stopRe.exec(tripBody)) !== null) {
      allPoints.push({ lat: parseFloat(m[1]), lng: parseFloat(m[2]) });
    }
    // First two are originLoc+destinationLoc — strip them, the rest are stops.
    const stopPoints = allPoints.slice(2);
    // Dedup consecutive duplicates and drop ones equal to origin/destination.
    const waypoints: Pt[] = [];
    for (const p of stopPoints) {
      if (p.lat === origin.lat && p.lng === origin.lng) continue;
      if (p.lat === destination.lat && p.lng === destination.lng) continue;
      const last = waypoints[waypoints.length - 1];
      if (last && last.lat === p.lat && last.lng === p.lng) continue;
      waypoints.push(p);
    }
    // Google Routes API allows up to ~25 intermediate waypoints; trim if needed.
    const trimmed = waypoints.length > 20 ? waypoints.filter((_, i) => i % Math.ceil(waypoints.length / 20) === 0) : waypoints;
    trips.push({
      slug,
      style: styleMatch?.[1],
      vehicle: vehMatch?.[1],
      origin,
      destination,
      waypoints: trimmed,
    });
  }
  return trips;
}

interface DirectionsResponse {
  distanceKm?: number;
  durationMin?: number;
  geometry?: Pt[];
  provider?: string;
  error?: string;
}

async function fetchOne(trip: Trip): Promise<DirectionsResponse | null> {
  const body = {
    origin: trip.origin,
    destination: trip.destination,
    waypoints: trip.waypoints,
    vehicleType: trip.vehicle ?? "car",
    routeStyle: trip.style ?? "scenic",
  };
  try {
    const res = await fetch(`${baseUrl}/api/public/directions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`  ✗ ${trip.slug}: HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as DirectionsResponse;
  } catch (err) {
    console.error(`  ✗ ${trip.slug}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const trips = parseTrips();
  console.log(`Parsed ${trips.length} curated trips`);
  console.log(`Base URL: ${baseUrl}\n`);

  let existing: Record<string, unknown> = {};
  try { existing = JSON.parse(readFileSync(outPath, "utf8")); } catch { /* empty */ }
  const out: Record<string, unknown> = { ...existing };
  let ok = 0;
  let fail = 0;
  for (const trip of trips) {
    process.stdout.write(`  • ${trip.slug} (${trip.waypoints.length} via)... `);
    const r = await fetchOne(trip);
    if (!r || !r.geometry || r.geometry.length < 2) {
      console.log("skipped");
      fail++;
      continue;
    }
    out[trip.slug] = {
      geometry: r.geometry,
      distanceKm: r.distanceKm ?? 0,
      durationMin: r.durationMin ?? 0,
      provider: r.provider,
      computedAt: new Date().toISOString(),
    };
    console.log(`${r.provider} · ${r.distanceKm}km · ${r.durationMin}min · ${r.geometry.length}pts`);
    ok++;
    // be polite to the API
    await new Promise((r) => setTimeout(r, 300));
  }
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
  console.log(`OK: ${ok}  Failed: ${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
