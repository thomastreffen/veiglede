// Public routing endpoint.
//
// Accepts origin/destination/preferences and returns a normalized route.
// Uses OpenRouteService when ORS_API_KEY is set; otherwise responds with
// a demo straight-line geometry so the client never has to special-case
// "no provider".
//
// Route time honesty (Routing v1.1):
// - We return ORS distance/duration AS-IS in km/min (rounded for display)
//   but ALSO return the raw meters/seconds and the profile + avoid options
//   used, so the client can show "Beregnet kjøretid" with honest helper
//   text and the debug panel can verify nothing is being multiplied.
// - We request `extra_info: ["waytypes"]` and try to separate the ferry
//   portion (waytype = 8) from driving when possible.
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
} as const;

interface LatLng { lat: number; lng: number }
interface Body {
  origin?: LatLng;
  destination?: LatLng;
  waypoints?: LatLng[];
  vehicleType?: string;
  routeStyle?: string;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n !== 0;
}

function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  // Reject null/undefined/NaN/0 — a 0 lat/lng usually means missing data
  // (Null Island), not a real waypoint. ORS requires real coordinates.
  if (!isFiniteNum(o.lat) || !isFiniteNum(o.lng)) return false;
  return (
    (o.lat as number) >= -90 && (o.lat as number) <= 90 &&
    (o.lng as number) >= -180 && (o.lng as number) <= 180
  );
}

function distKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function interpolate(a: LatLng, b: LatLng, steps = 32): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return pts;
}

function demoResponse(body: Body, warnings: string[]) {
  const km = Math.round(distKm(body.origin!, body.destination!) * 1.25);
  const speed = body.routeStyle === "fastest" ? 75 : 60;
  return {
    distanceKm: km,
    durationMin: Math.round((km / speed) * 60),
    geometry: interpolate(body.origin!, body.destination!, 32),
    provider: "demo" as const,
    profile: "driving-car",
    avoidOptions: { highways: !!body.avoidHighways, ferries: !!body.avoidFerries },
    warnings: warnings.length ? warnings : undefined,
  };
}

export const Route = createFileRoute("/api/public/directions")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let body: Body;
        try { body = (await request.json()) as Body; }
        catch { return json({ error: "invalid-json" }, 400); }

        if (!isLatLng(body.origin) || !isLatLng(body.destination)) {
          return json({ error: "invalid-coordinates" }, 400);
        }

        const key = (process.env.ORS_API_KEY ?? "").trim();
        const warnings: string[] = [];
        const avoidOptions = {
          highways: !!body.avoidHighways,
          ferries: !!body.avoidFerries,
        };

        if (!key) {
          return json(demoResponse(body, ["no-ors-key"]));
        }

        try {
          const avoid: string[] = [];
          if (body.avoidHighways) avoid.push("highways");
          if (body.avoidFerries) avoid.push("ferries");

          const originPair: [number, number] = [Number(body.origin.lng), Number(body.origin.lat)];
          const destPair: [number, number] = [Number(body.destination.lng), Number(body.destination.lat)];
          const exactSame = (a: [number, number], b: [number, number]) =>
            Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
          const nearKm = (a: [number, number], b: [number, number]) =>
            distKm({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });

          const rawVia = Array.isArray(body.waypoints) ? body.waypoints : [];
          const viaCoords: [number, number][] = [];
          rawVia.forEach((w, i) => {
            if (!isLatLng(w)) {
              console.warn("[directions] skipping invalid waypoint", { index: i, value: w });
              warnings.push(`ors-skip-waypoint-${i}`);
              return;
            }
            const pair: [number, number] = [Number(w.lng), Number(w.lat)];
            // Drop anything that is effectively the origin or destination
            // (exact match OR within 1km — covers auto-generated arrival/
            // departure stops whose coords resolve to the same town).
            if (exactSame(pair, originPair) || nearKm(pair, originPair) < 1) {
              warnings.push(`ors-dedupe-origin-waypoint-${i}`);
              return;
            }
            if (exactSame(pair, destPair) || nearKm(pair, destPair) < 1) {
              warnings.push(`ors-dedupe-destination-waypoint-${i}`);
              return;
            }
            if (viaCoords.some((existing) => exactSame(existing, pair))) {
              warnings.push(`ors-dedupe-waypoint-${i}`);
              return;
            }
            viaCoords.push(pair);
          });

          // Pre-snap each via-point to the nearest road via ORS Snap endpoint.
          // The hosted ORS instance enforces a 350m max snap radius on directions
          // and ignores `radiuses: [-1]`, so waypoints far from roads (e.g.
          // mountain passes) cause a 404. Snap with a 5km radius first.
          const snappedVia: [number, number][] = [];
          for (let i = 0; i < viaCoords.length; i++) {
            const pair = viaCoords[i];
            try {
              const snapRes = await fetch(
                `https://api.openrouteservice.org/v2/snap/driving-car`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: key,
                  },
                  body: JSON.stringify({ locations: [pair], radius: 5000 }),
                },
              );
              if (!snapRes.ok) {
                console.warn(`[directions] Skipped waypoint #${i} — snap HTTP ${snapRes.status}`);
                warnings.push(`ors-snap-failed-waypoint-${i}`);
                continue;
              }
              const snapData = await snapRes.json();
              const loc = snapData?.locations?.[0];
              const snappedLng = loc?.location?.[0];
              const snappedLat = loc?.location?.[1];
              if (typeof snappedLng !== "number" || typeof snappedLat !== "number") {
                console.warn(`[directions] Skipped waypoint #${i} — no routable road within 5km`, pair);
                warnings.push(`ors-snap-no-road-waypoint-${i}`);
                continue;
              }
              snappedVia.push([snappedLng, snappedLat]);
            } catch (err) {
              console.warn(`[directions] Skipped waypoint #${i} — snap error`, err);
              warnings.push(`ors-snap-error-waypoint-${i}`);
            }
          }

          // ORS expects exactly: [origin, ...via, destination] as [lng,lat] pairs.
          const coordinates: [number, number][] = [originPair, ...snappedVia, destPair];
          const radiuses = coordinates.map(() => -1);
          const orsBody: Record<string, unknown> = {
            coordinates,
            radiuses,
            instructions: false,
            extra_info: ["waytype"],
          };
          if (avoid.length) orsBody.options = { avoid_features: avoid };
          warnings.push(`ors-waypoint-count-${snappedVia.length + 2}`);
          console.log(`[directions] Snapped via coordinates:`, snappedVia);
          console.log(`[directions] ORS coordinates: ${coordinates.length} points`, coordinates);


          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const profile = "driving-car";
          const res = await fetch(
            `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: key,
              },
              body: JSON.stringify(orsBody),
              signal: controller.signal,
            },
          );
          clearTimeout(timeout);
          console.log("[directions] ORS response status", res.status);

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[directions] ORS non-200 response", {
              status: res.status,
              body: text,
            });
            // TEMPORARY DEBUG: surface raw ORS error to the client so we can
            // inspect it in the browser network tab. Revert after debugging.
            return json({
              debug: true,
              orsStatus: res.status,
              orsBody: text,
              sentCoordinates: coordinates,
              sentRadiuses: radiuses,
            });
          }
          const data = await res.json();
          const feat = data?.features?.[0];
          const coords: [number, number][] = feat?.geometry?.coordinates ?? [];
          const summary = feat?.properties?.summary ?? {};
          if (!coords.length) {
            warnings.push("ors-no-geometry");
            return json(demoResponse(body, warnings));
          }

          // Extra info: waytypes — try to derive ferry duration/distance.
          // ORS shape: properties.extras.waytypes.values = [[fromIdx,toIdx,type], ...]
          //            and a per-step summary at properties.extras.waytypes.summary
          let ferryDurationSec: number | null = null;
          let ferryDistanceM: number | null = null;
          const extras = feat?.properties?.extras?.waytype;
          if (extras?.summary && Array.isArray(extras.summary)) {
            const ferry = extras.summary.find((s: { value: number }) => s.value === 8);
            if (ferry) {
              ferryDistanceM = typeof ferry.distance === "number" ? ferry.distance : null;
              // ORS doesn't give per-waytype duration in summary — only distance + amount.
              // We approximate ferry duration with the route's average speed on that
              // segment ratio (good enough for "inkludert i rutetid" semantics).
              if (ferryDistanceM && summary.distance && summary.duration) {
                const ratio = ferryDistanceM / summary.distance;
                ferryDurationSec = Math.round(summary.duration * ratio);
              }
            }
          }

          const rawDistanceMeters = typeof summary.distance === "number" ? summary.distance : 0;
          const rawDurationSeconds = typeof summary.duration === "number" ? summary.duration : 0;

          return json({
            distanceKm: rawDistanceMeters ? Math.round(rawDistanceMeters / 100) / 10 : 0,
            durationMin: rawDurationSeconds ? Math.round(rawDurationSeconds / 60) : 0,
            geometry: coords.map(([lng, lat]) => ({ lat, lng })),
            provider: "ors" as const,
            profile,
            avoidOptions,
            rawDistanceMeters,
            rawDurationSeconds,
            ferryDistanceKm: ferryDistanceM ? Math.round(ferryDistanceM / 100) / 10 : 0,
            ferryDurationMin: ferryDurationSec ? Math.round(ferryDurationSec / 60) : 0,
            warnings: warnings.length ? warnings : undefined,
          });
        } catch (err) {
          warnings.push(`ors-error-${(err as Error)?.name ?? "unknown"}`);
          return json(demoResponse(body, warnings));
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
