// Public POI search endpoint.
//
// Generates realistic Norwegian POIs along a route using the Lovable AI
// Gateway (Gemini). Mapbox/MapTiler returned empty for many Norwegian POI
// categories; an LLM produces well-known real-world places we can present
// as suggestions. The response shape matches what the frontend already
// consumes: { features: [{ id, name, place_name, category, lng, lat }] }.

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json",
} as const;

interface AiStop {
  name?: string;
  type?: string;
  location?: string;
  lat?: number;
  lng?: number;
  description?: string;
  detourMin?: number;
}

interface ProxyFeature {
  id: string;
  name: string;
  place_name: string;
  category: string;
  description?: string;
  detourMin?: number;
  lng: number;
  lat: number;
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
        const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") ?? "5") || 5));
        if (!q) return json({ debug: true, source: "ai", features: [], warning: "missing-q" }, 400);
        if (!/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(bbox)) {
          return json({ debug: true, source: "ai", features: [], warning: "missing-or-bad-bbox" }, 400);
        }

        const apiKey = (process.env.LOVABLE_API_KEY ?? "").trim();
        if (!apiKey) {
          return json({ debug: true, source: "ai", features: [], warning: "no-lovable-api-key" });
        }

        const [minLngS, minLatS, maxLngS, maxLatS] = bbox.split(",");
        const minLng = Number(minLngS), minLat = Number(minLatS);
        const maxLng = Number(maxLngS), maxLat = Number(maxLatS);

        const qLower = q.toLowerCase();
        const isCharging = /charging|ev charging|hurtiglader|lader|ladestasjon|elbil/.test(qLower);

        const prompt = isCharging
          ? `Foreslå 1–2 reelle hurtigladestasjoner for elbil i Norge ` +
            `innenfor området (lat ${minLat.toFixed(3)}–${maxLat.toFixed(3)}, lng ${minLng.toFixed(3)}–${maxLng.toFixed(3)})` +
            (proximity ? `, nær punktet ${proximity} (lng,lat)` : "") +
            `.\n\nReturner KUN gyldig JSON via verktøyet suggest_stops.\n` +
            `Krav til hvert stopp:\n` +
            `- Bruk ekte norske hurtigladeoperatører: Recharge, Mer, Tesla Supercharger, Ionity, Circle K Charge, Eviny.\n` +
            `- "name" skal være operatør + sted (eks: "Recharge Dombås", "Ionity Lillehammer", "Tesla Supercharger Lier").\n` +
            `- "type" skal være "charging".\n` +
            `- Kun reelle, kjente ladestasjoner som faktisk finnes på lokasjonen. Koordinatene må ligge innenfor området.\n` +
            `- "description" skal være ÉN konkret setning på norsk om laderen (antall ladere, effekt i kW, fasiliteter). ` +
            `Eksempel: "12× 300 kW lynladere ved E6, kafé og toaletter".\n` +
            `- "detourMin" = realistisk ladetid i minutter (20–45). 20 = rask topp-opp, 45 = full ladning.\n` +
            `- "location" = nærmeste tettsted/kommune.\n` +
            `- Variér operatører hvis du foreslår flere.`
          : `Foreslå inntil ${limit} realistiske, faktiske stoppesteder i Norge ` +
            `i kategorien "${q}" innenfor dette geografiske området ` +
            `(lat ${minLat.toFixed(3)}–${maxLat.toFixed(3)}, lng ${minLng.toFixed(3)}–${maxLng.toFixed(3)})` +
            (proximity ? `, nær punktet ${proximity} (lng,lat)` : "") +
            `.\n\nReturner KUN gyldig JSON via verktøyet suggest_stops.\n` +
            `Krav til hvert stopp:\n` +
            `- Kun ekte, kjente steder som faktisk finnes. Koordinatene må ligge innenfor området.\n` +
            `- "description" skal være ÉN konkret setning på norsk som forklarer hvorfor stedet er verdt et stopp. ` +
            `Eksempel: "Panoramautsikt over Kragerø-skjærgården — populært fotostopp langs E18". ` +
            `Ikke bare gjenta kategorinavnet ("Viewpoint", "Cafe").\n` +
            `- "detourMin" er realistisk omveistid t/r fra hovedruten i minutter (5–45). ` +
            `Stopp som ligger rett ved veien skal ha 5–10. Lengre avstikker 20–45.\n` +
            `- "location" er nærmeste tettsted/kommune i Norge.\n` +
            `- Variér stedene; ikke gjenta navn.`;

        const body = {
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Du er en lokalkjent norsk reiseguide. Foreslå kun ekte, kjente steder med korrekte koordinater og konkrete, fristende beskrivelser.",
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "suggest_stops",
                description: "Returner foreslåtte stoppesteder langs en rute i Norge.",
                parameters: {
                  type: "object",
                  properties: {
                    stops: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: {
                            type: "string",
                            enum: ["cafe", "viewpoint", "museum", "fuel", "charging", "attraction", "pause", "food"],
                          },
                          location: { type: "string", description: "Tettsted/kommune, Norge" },
                          lat: { type: "number" },
                          lng: { type: "number" },
                          description: {
                            type: "string",
                            description: "Én konkret setning på norsk som forklarer hvorfor stedet er verdt et stopp.",
                          },
                          detourMin: {
                            type: "number",
                            description: "Realistisk omveistid t/r fra hovedruten i minutter (5–45).",
                          },
                        },
                        required: ["name", "type", "lat", "lng", "description", "detourMin"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["stops"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "suggest_stops" } },
        };

        const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        try {
          console.log(`[poi-search] ai gateway query: q="${q}" bbox=${bbox}`);
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 15000);
          const res = await fetch(aiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          clearTimeout(t);

          if (res.status === 429) {
            return json({ debug: true, source: "ai", aiStatus: 429, features: [], warning: "rate-limited" });
          }
          if (res.status === 402) {
            return json({ debug: true, source: "ai", aiStatus: 402, features: [], warning: "payment-required" });
          }
          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            return json({
              debug: true, source: "ai", aiStatus: res.status, features: [],
              warning: `ai-http-${res.status}`, errorPreview: errText.slice(0, 300),
            });
          }

          const data = (await res.json()) as {
            choices?: Array<{
              message?: {
                tool_calls?: Array<{ function?: { arguments?: string } }>;
                content?: string;
              };
            }>;
          };

          const toolArgs = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          let parsed: { stops?: AiStop[] } = {};
          if (toolArgs) {
            try { parsed = JSON.parse(toolArgs); } catch { /* ignore */ }
          } else if (data.choices?.[0]?.message?.content) {
            // Fallback: try to extract JSON from a content message.
            const raw = data.choices[0]!.message!.content!.trim();
            const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (m) {
              try {
                const j = JSON.parse(m[0]);
                parsed = Array.isArray(j) ? { stops: j } : j;
              } catch { /* ignore */ }
            }
          }

          const features: ProxyFeature[] = (parsed.stops ?? [])
            .map((s, i): ProxyFeature | null => {
              const lat = Number(s.lat), lng = Number(s.lng);
              if (!s.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              // Clamp to requested bbox so suggestions stay near the route.
              if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return null;
              const loc = (s.location ?? "").trim();
              const desc = (s.description ?? "").trim();
              const detourRaw = Number(s.detourMin);
              const detourMin = Number.isFinite(detourRaw)
                ? Math.max(5, Math.min(45, Math.round(detourRaw)))
                : undefined;
              return {
                id: `ai-${q}-${i}-${lng.toFixed(3)}-${lat.toFixed(3)}`,
                name: s.name.trim(),
                place_name: loc ? `${s.name.trim()}, ${loc}` : s.name.trim(),
                category: (s.type ?? q).trim(),
                description: desc || undefined,
                detourMin,
                lng,
                lat,
              };
            })
            .filter((f): f is ProxyFeature => f !== null)
            .slice(0, limit);

          return json({ debug: true, source: "ai", aiStatus: res.status, features });
        } catch (err) {
          return json({
            debug: true, source: "ai", features: [],
            warning: `ai-error-${(err as Error)?.name ?? "unknown"}`,
          });
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
