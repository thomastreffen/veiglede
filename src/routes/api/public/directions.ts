// Public routing endpoint.
//
// Proxies to the Mapbox Directions API. Returns a normalized route shape
// so the rest of the app does not need to know about the provider.

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
    profile: "driving",
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

        const token = (process.env.MAPBOX_TOKEN ?? "").trim();
        const warnings: string[] = [];
        const avoidOptions = {
          highways: !!body.avoidHighways,
          ferries: !!body.avoidFerries,
        };

        if (!token) {
          return json(demoResponse(body, ["no-mapbox-token"]));
        }

        try {
          const originPair: [number, number] = [Number(body.origin.lng), Number(body.origin.lat)];
          const destPair: [number, number] = [Number(body.destination.lng), Number(body.destination.lat)];

          const rawVia = Array.isArray(body.waypoints) ? body.waypoints : [];
          const viaCoords: [number, number][] = [];
          rawVia.forEach((w, i) => {
            if (!isLatLng(w)) {
              warnings.push(`mapbox-skip-waypoint-${i}`);
              return;
            }
            viaCoords.push([Number(w.lng), Number(w.lat)]);
          });

          const coordinates: [number, number][] = [originPair, ...viaCoords, destPair];
          const coordStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;

          console.log(`[directions] Mapbox coordinates: ${coordinates.length} points`, coordinates);

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("[directions] Mapbox non-200 response", { status: res.status, body: text });
            warnings.push(`mapbox-http-${res.status}`);
            return json(demoResponse(body, warnings));
          }

          const data = await res.json();
          const route = data?.routes?.[0];
          const coords: [number, number][] = route?.geometry?.coordinates ?? [];
          if (!coords.length) {
            warnings.push("mapbox-no-geometry");
            return json(demoResponse(body, warnings));
          }

          const rawDistanceMeters = typeof route.distance === "number" ? route.distance : 0;
          const rawDurationSeconds = typeof route.duration === "number" ? route.duration : 0;

          return json({
            distanceKm: rawDistanceMeters ? Math.round(rawDistanceMeters / 100) / 10 : 0,
            durationMin: rawDurationSeconds ? Math.round(rawDurationSeconds / 60) : 0,
            geometry: coords.map(([lng, lat]) => ({ lat, lng })),
            provider: "mapbox" as const,
            profile: "driving",
            avoidOptions,
            rawDistanceMeters,
            rawDurationSeconds,
            warnings: warnings.length ? warnings : undefined,
          });
        } catch (err) {
          warnings.push(`mapbox-error-${(err as Error)?.name ?? "unknown"}`);
          return json(demoResponse(body, warnings));
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
