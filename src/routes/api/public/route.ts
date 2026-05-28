// Public routing endpoint.
//
// Accepts origin/destination/preferences and returns a normalized route.
// Uses OpenRouteService when ORS_API_KEY is set; otherwise responds with
// a demo straight-line geometry so the client never has to special-case
// "no provider".
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
    warnings: warnings.length ? warnings : undefined,
  };
}

export const Route = createFileRoute("/api/public/route")({
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

        if (body.avoidHighways && body.vehicleType === "motorcycle") {
          // ORS supports avoid_features, but only for some profiles; still accepted.
        }

        if (!key) {
          return json(demoResponse(body, ["no-ors-key"]));
        }

        try {
          const avoid: string[] = [];
          if (body.avoidHighways) avoid.push("highways");
          if (body.avoidFerries) avoid.push("ferries");

          const orsBody: Record<string, unknown> = {
            coordinates: [
              [body.origin.lng, body.origin.lat],
              [body.destination.lng, body.destination.lat],
            ],
            instructions: false,
          };
          if (avoid.length) {
            orsBody.options = { avoid_features: avoid };
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(
            "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
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
            warnings.push(`ors-http-${res.status}`);
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
          return json({
            distanceKm: summary.distance ? Math.round(summary.distance / 100) / 10 : 0,
            durationMin: summary.duration ? Math.round(summary.duration / 60) : 0,
            geometry: coords.map(([lng, lat]) => ({ lat, lng })),
            provider: "ors" as const,
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
