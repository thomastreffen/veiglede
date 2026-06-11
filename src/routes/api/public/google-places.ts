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
  "Cache-Control": "no-store, max-age=0",
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
  fuel: ["gas_station"],
  charging: ["electric_vehicle_charging_station"],
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
        // Server-side proxy: gateway forwards with empty referrer, so we MUST
        // use an unrestricted server key (the Lovable-managed connection).
        // Referrer-restricted browser keys (often present in user-added
        // custom connections suffixed _1/_2) get rejected with 403
        // "Requests from referer <empty> are blocked." Prefer the managed
        // key first; fall back to numbered keys only if the base is unset.
        const mapsKey = (
          process.env.GOOGLE_MAPS_API_KEY ??
          process.env.GOOGLE_MAPS_API_KEY_1 ??
          process.env.GOOGLE_MAPS_API_KEY_2 ??
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

        if (action === "reverse") {
          const lat = Number(url.searchParams.get("lat"));
          const lng = Number(url.searchParams.get("lng"));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return json({ error: "bad-latlng" }, 400);
          }
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(
              `${GATEWAY_URL}/maps/api/geocode/json?latlng=${lat},${lng}&language=no&result_type=street_address|premise|route|locality|postal_town`,
              { signal: ctrl.signal, headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": mapsKey } },
            );
            clearTimeout(t);
            if (!res.ok) return json({ error: `reverse-${res.status}` }, 502);
            const data = (await res.json()) as {
              results?: Array<{
                formatted_address?: string;
                address_components?: Array<{ long_name?: string; types?: string[] }>;
                types?: string[];
              }>;
            };
            const first = data.results?.[0];
            if (!first) return json({ label: null });
            // Prefer a short "Street + City" or just "City" label.
            const comps = first.address_components ?? [];
            const pick = (t: string) => comps.find((c) => c.types?.includes(t))?.long_name;
            const street = pick("route");
            const num = pick("street_number");
            const city = pick("postal_town") ?? pick("locality") ?? pick("administrative_area_level_2");
            let label: string | null = null;
            if (street && city) label = num ? `${street} ${num}, ${city}` : `${street}, ${city}`;
            else if (city) label = city;
            else label = first.formatted_address ?? null;
            return json({ label, address: first.formatted_address ?? null });
          } catch (err) {
            return json({ error: `reverse-error-${(err as Error)?.name ?? "unknown"}` }, 502);
          }
        }

        // autocomplete
        const rawInput = (url.searchParams.get("input") ?? "").trim().slice(0, 200);
        if (rawInput.length < 2) return json({ results: [] });
        const category = (url.searchParams.get("category") ?? "").trim();
        const input = normalizeQuery(rawInput, category);
        if (input.length < 2) return json({ results: [] });
        const lng = Number(url.searchParams.get("lng") ?? "9.0");
        const lat = Number(url.searchParams.get("lat") ?? "61.0");
        const radius = Math.max(1000, Math.min(50000, Number(url.searchParams.get("radius") ?? "50000") || 50000));

        const baseBody: Record<string, unknown> = {
          input,
          languageCode: "no",
          regionCode: "NO",
          includedRegionCodes: ["no", "se", "dk", "de"],
          locationBias: {
            circle: {
              center: { latitude: Number.isFinite(lat) ? lat : 59.9, longitude: Number.isFinite(lng) ? lng : 10.75 },
              radius,
            },
          },
        };

        const runAutocomplete = async (body: Record<string, unknown>) => {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          try {
            const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
              method: "POST",
              signal: ctrl.signal,
              headers: authHeaders,
              body: JSON.stringify(body),
            });
            clearTimeout(t);
            if (!res.ok) {
              const text = await res.text().catch(() => "");
              return { ok: false as const, status: res.status, detail: text.slice(0, 200) };
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
            return { ok: true as const, results };
          } catch (err) {
            clearTimeout(t);
            return { ok: false as const, status: 0, detail: (err as Error)?.name ?? "unknown" };
          }
        };

        const typedBody = category && TYPES_FOR_CATEGORY[category]
          ? { ...baseBody, includedPrimaryTypes: TYPES_FOR_CATEGORY[category] }
          : baseBody;
        let r = await runAutocomplete(typedBody);
        // Fallback: if type-filtered search returned nothing, retry without
        // type filter — many Norwegian hotels/stations aren't tagged.
        if (r.ok && r.results.length === 0 && category && TYPES_FOR_CATEGORY[category]) {
          r = await runAutocomplete(baseBody);
        }
        if (!r.ok) {
          return json({ results: [], warning: `autocomplete-${r.status}`, detail: r.detail });
        }
        return json({ results: r.results });
      },
    },
  },
});

// Strip Norwegian category filler words ("hotell i risør" → "risør") so
// Google Places gets a clean location/brand query. Brand names (Scandic,
// Circle K, etc.) stay untouched because they're not in the strip list.
function normalizeQuery(input: string, category: string): string {
  let q = input.toLowerCase();
  const patterns: RegExp[] = [];
  if (category === "lodging") {
    patterns.push(
      /\b(hotell|hoteller|hytte|hytter|camping|campingplass|overnatting|bed\s*&?\s*breakfast|b&b)\s+i\s+/g,
      /\b(hotell|hoteller|hytte|hytter|camping|campingplass|overnatting)\b/g,
    );
  } else if (category === "fuel") {
    patterns.push(
      /\b(bensinstasjon|bensin|drivstoff)\s+i\s+/g,
      /\b(bensinstasjon|bensin|drivstoff)\b/g,
    );
  } else if (category === "charging") {
    patterns.push(
      /\b(ladestasjon|lader|lading|hurtiglader|ladepunkt)\s+i\s+/g,
      /\b(ladestasjon|lader|lading|hurtiglader|ladepunkt)\b/g,
    );
  }

  for (const p of patterns) q = q.replace(p, " ");
  q = q.replace(/^\s*i\s+/g, " ").replace(/\s+i\s+/g, " ");
  q = q.replace(/\s+/g, " ").trim();
  return q || input.trim();
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
