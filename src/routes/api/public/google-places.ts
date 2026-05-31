// Google Places API (New) proxy via the Lovable Google Maps connector gateway.
//
// Two actions:
//   GET ?action=autocomplete&input=...&category=fuel|lodging&lng=..&lat=..
//   GET ?action=details&placeId=...
//
// Returns a normalized shape the geocoder maps into ResolvedPlace.
// Norway-biased: language=no, regionCode=NO, country filter NO/SE/DK/DE,
// 500 km circular bias around (61.0, 9.0) by default, or around the
// caller-supplied lng/lat (e.g. trip route midpoint) when provided.

import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
  "Content-Type": "application/json",
} as const;

interface GSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    types?: string[];
  };
}

interface GPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
}

const TYPES_FOR_CATEGORY: Record<string, string[]> = {
  fuel: ["gas_station", "electric_vehicle_charging_station"],
  lodging: ["lodging"],
};

export const Route = createFileRoute("/api/public/google-places")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = (url.searchParams.get("action") ?? "autocomplete").trim();

        const lovableKey = (process.env.LOVABLE_API_KEY ?? "").trim();
        // Prefer the user-supplied custom connection (suffix _1) over the
        // Lovable-managed key — the managed key is locked to *.lovable.app
        // and will fail browser referrer checks on custom domains.
        const mapsKey = (
          process.env.GOOGLE_MAPS_API_KEY_2 ??
          process.env.GOOGLE_MAPS_API_KEY_1 ??
          process.env.GOOGLE_MAPS_API_KEY ??
          ""
        ).trim();
        if (!lovableKey || !mapsKey) {
          return json({ error: "google-maps-not-configured" }, 503);
        }
        const authHeaders: Record<string, string> = {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
          "Content-Type": "application/json",
        };

        if (action === "details") {
          const placeId = (url.searchParams.get("placeId") ?? "").trim();
          if (!placeId || placeId.length > 256) return json({ error: "bad-place-id" }, 400);
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(
              `${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}`,
              {
                signal: ctrl.signal,
                headers: {
                  ...authHeaders,
                  "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
                },
              },
            );
            clearTimeout(t);
            if (!res.ok) return json({ error: `details-${res.status}` }, 502);
            const p = (await res.json()) as GPlace;
            const lat = p.location?.latitude;
            const lng = p.location?.longitude;
            if (typeof lat !== "number" || typeof lng !== "number") {
              return json({ error: "no-location" }, 502);
            }
            return json({
              place: {
                id: p.id ?? placeId,
                name: p.displayName?.text ?? "",
                address: p.formattedAddress ?? "",
                lat,
                lng,
                types: p.types ?? [],
              },
            });
          } catch (err) {
            return json({ error: `details-error-${(err as Error)?.name ?? "unknown"}` }, 502);
          }
        }

        // autocomplete
        const input = (url.searchParams.get("input") ?? "").trim().slice(0, 200);
        if (input.length < 2) return json({ results: [] });
        const category = (url.searchParams.get("category") ?? "").trim();
        const lng = Number(url.searchParams.get("lng") ?? "9.0");
        const lat = Number(url.searchParams.get("lat") ?? "61.0");
        const radius = Math.max(1000, Math.min(500000, Number(url.searchParams.get("radius") ?? "500000") || 500000));

        const body: Record<string, unknown> = {
          input,
          languageCode: "no",
          regionCode: "NO",
          includedRegionCodes: ["no", "se", "dk", "de"],
          locationBias: {
            circle: {
              center: { latitude: Number.isFinite(lat) ? lat : 61.0, longitude: Number.isFinite(lng) ? lng : 9.0 },
              radius,
            },
          },
        };
        if (category && TYPES_FOR_CATEGORY[category]) {
          body.includedPrimaryTypes = TYPES_FOR_CATEGORY[category];
        }

        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
            method: "POST",
            signal: ctrl.signal,
            headers: authHeaders,
            body: JSON.stringify(body),
          });
          clearTimeout(t);
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return json({ results: [], warning: `autocomplete-${res.status}`, detail: text.slice(0, 200) });
          }
          const data = (await res.json()) as { suggestions?: GSuggestion[] };
          const results = (data.suggestions ?? [])
            .map((s, i) => {
              const p = s.placePrediction;
              if (!p?.placeId) return null;
              const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? "";
              const secondary = p.structuredFormat?.secondaryText?.text ?? "";
              return {
                id: p.placeId,
                name: main || (p.text?.text ?? `Result ${i + 1}`),
                address: secondary,
                types: p.types ?? [],
              };
            })
            .filter((x): x is { id: string; name: string; address: string; types: string[] } => x !== null);
          return json({ results });
        } catch (err) {
          return json({ results: [], warning: `autocomplete-error-${(err as Error)?.name ?? "unknown"}` });
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
