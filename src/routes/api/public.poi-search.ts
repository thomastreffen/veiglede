// Public POI search endpoint.
//
// Proxies to the Mapbox Places API (geocoding v5) so the browser does not
// need to know MAPBOX_TOKEN. Returns a small normalized feature list.

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json",
} as const;

interface MapboxFeature {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  properties?: { category?: string; maki?: string };
}

export const Route = createFileRoute("/api/public/poi-search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
        const bbox = (url.searchParams.get("bbox") ?? "").trim();
        const proximity = (url.searchParams.get("proximity") ?? "").trim();
        const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") ?? "3") || 3));
        if (!q) return json({ features: [] }, 400);

        const token = (process.env.MAPBOX_TOKEN ?? "").trim();
        if (!token) return json({ features: [], warning: "no-mapbox-token" });

        const params = new URLSearchParams();
        params.set("types", "poi");
        params.set("limit", String(limit));
        params.set("language", "nb");
        if (bbox && /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bbox)) params.set("bbox", bbox);
        if (proximity && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(proximity)) params.set("proximity", proximity);
        params.set("access_token", token);

        const mbUrl =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;

        const redactedUrl = mbUrl.replace(token, "REDACTED");
        try {
          console.log(`[poi-search] mapbox url: ${redactedUrl}`);
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 6000);
          const res = await fetch(mbUrl, { signal: ctrl.signal });
          clearTimeout(t);
          if (!res.ok) {
            return json({ debug: true, mapboxUrl: redactedUrl, mapboxStatus: res.status, features: [], warning: `mapbox-http-${res.status}` });
          }
          const data = (await res.json()) as { features?: MapboxFeature[] };
          const features = (data.features ?? []).map((f) => ({
            id: f.id,
            name: f.text ?? "",
            place_name: f.place_name ?? "",
            category: f.properties?.category ?? f.properties?.maki ?? "",
            lng: f.center?.[0],
            lat: f.center?.[1],
          })).filter((f) => f.name && typeof f.lng === "number" && typeof f.lat === "number");
          return json({ debug: true, mapboxUrl: redactedUrl, mapboxStatus: res.status, features });
        } catch (err) {
          return json({ debug: true, mapboxUrl: redactedUrl, mapboxStatus: 0, features: [], warning: `mapbox-error-${(err as Error)?.name ?? "unknown"}` });
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
