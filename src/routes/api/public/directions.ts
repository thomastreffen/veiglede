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
  vehicleType?: string;
  routeStyle?: string;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.lat === "number" && typeof o.lng === "number" &&
    o.lat >= -90 && o.lat <= 90 && o.lng >= -180 && o.lng <= 180
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

          const orsBody: Record<string, unknown> = {
            // ORS expects [lng, lat] pairs.
            coordinates: [
              [body.origin.lng, body.origin.lat],
              [body.destination.lng, body.destination.lat],
            ],
            instructions: false,
            // waytype: ORS extra_info key (singular). value 8 = ferry, so we
            // can separate ferry duration from driving when present.
            extra_info: ["waytype"],
          };
          if (avoid.length) orsBody.options = { avoid_features: avoid };

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

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            warnings.push(`ors-http-${res.status}`);
            if (text) warnings.push(`ors-body-${text.slice(0, 180)}`);
            return json(demoResponse(body, warnings));
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
