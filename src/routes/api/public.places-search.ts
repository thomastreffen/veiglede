// Public Foursquare Places search proxy.
//
// Foursquare returns far better POI results in Norway than MapTiler/Mapbox
// for hotels, restaurants, fuel stations and attractions. The API key lives
// only on the server (process.env.FOURSQUARE_API_KEY).
//
// Returns a normalized shape the geocoder maps into ResolvedPlace.

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
  "Content-Type": "application/json",
} as const;

interface FsqLocation {
  address?: string;
  locality?: string;
  region?: string;
  country?: string;
  formatted_address?: string;
}
interface FsqCategory { name?: string; id?: number }
interface FsqGeocodes { main?: { latitude?: number; longitude?: number } }
interface FsqPlace {
  fsq_id?: string;
  name?: string;
  location?: FsqLocation;
  categories?: FsqCategory[];
  geocodes?: FsqGeocodes;
  distance?: number;
}

export const Route = createFileRoute("/api/public/places-search")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("query") ?? "").trim().slice(0, 120);
        const ll = (url.searchParams.get("ll") ?? "").trim(); // "lat,lng"
        const near = (url.searchParams.get("near") ?? "").trim();
        const radius = Math.max(100, Math.min(100000, Number(url.searchParams.get("radius") ?? "50000") || 50000));
        const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") ?? "8") || 8));
        const categories = (url.searchParams.get("categories") ?? "").trim();
        const locale = (url.searchParams.get("locale") ?? "no").trim();

        if (q.length < 2) return json({ results: [] });

        const key = (process.env.FOURSQUARE_API_KEY ?? "").trim();
        if (!key) return json({ results: [], warning: "no-foursquare-key" });

        const params = new URLSearchParams({
          query: q,
          limit: String(limit),
          fields: "fsq_id,name,location,categories,distance,geocodes",
        });
        if (ll) {
          params.set("ll", ll);
          params.set("radius", String(radius));
        } else if (near) {
          params.set("near", near);
        } else {
          params.set("near", "Norge");
        }
        if (categories) params.set("categories", categories);

        const apiUrl = `https://api.foursquare.com/v3/places/search?${params.toString()}`;

        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(apiUrl, {
            signal: ctrl.signal,
            headers: {
              Authorization: key,
              Accept: "application/json",
              "Accept-Language": locale,
            },
          });
          clearTimeout(t);
          if (!res.ok) return json({ results: [], warning: `foursquare-${res.status}` });
          const data = (await res.json()) as { results?: FsqPlace[] };
          const results = (data.results ?? []).map((p, i) => {
            const lat = p.geocodes?.main?.latitude;
            const lng = p.geocodes?.main?.longitude;
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            const loc = p.location ?? {};
            const address = loc.address ?? "";
            const city = loc.locality ?? loc.region ?? "";
            const country = loc.country ?? "";
            return {
              id: p.fsq_id ?? `fsq-${i}`,
              name: p.name ?? q,
              address: loc.formatted_address ?? [address, city, country].filter(Boolean).join(", "),
              city,
              country,
              lat,
              lng,
              category: p.categories?.[0]?.name ?? "",
            };
          }).filter((x): x is NonNullable<typeof x> => x !== null);
          return json({ results });
        } catch (err) {
          return json({ results: [], warning: `foursquare-error-${(err as Error)?.name ?? "unknown"}` });
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
