// Public Mapbox Geocoding proxy.
//
// Used by autocomplete inputs that need POI-quality results that MapTiler
// returns poorly for Norway — specifically fuel/charging stations and lodging
// in the "+" quick-add sheet.
//
// The Mapbox access token lives only on the server (process.env.MAPBOX_TOKEN).

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
  "Content-Type": "application/json",
} as const;

interface MapboxFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];
  context?: { id?: string; text?: string }[];
  properties?: { category?: string };
}

export const Route = createFileRoute("/api/public/mapbox-geocode")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
        const proximity = (url.searchParams.get("proximity") ?? "").trim(); // "lng,lat"
        const bbox = (url.searchParams.get("bbox") ?? "4.0,57.0,32.0,71.5").trim();
        const types = (url.searchParams.get("types") ?? "poi").trim();
        const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") ?? "5") || 5));
        const language = (url.searchParams.get("language") ?? "no").trim();
        const country = (url.searchParams.get("country") ?? "no,se,dk,fi").trim();

        if (q.length < 2) return json({ features: [] });

        const token = (process.env.MAPBOX_TOKEN ?? "").trim();
        if (!token) return json({ features: [], warning: "no-mapbox-token" });

        const params = new URLSearchParams({
          access_token: token,
          types,
          limit: String(limit),
          language,
          country,
          bbox,
        });
        if (proximity) params.set("proximity", proximity);
        const apiUrl =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;

        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(apiUrl, { signal: ctrl.signal });
          clearTimeout(t);
          if (!res.ok) {
            return json({ features: [], warning: `mapbox-${res.status}` });
          }
          const data = (await res.json()) as { features?: MapboxFeature[] };
          return json({ features: data.features ?? [] });
        } catch (err) {
          return json({ features: [], warning: `mapbox-error-${(err as Error)?.name ?? "unknown"}` });
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
