// AI-powered trip plan generator.
// Calls Lovable AI Gateway with tool calling to return a structured day-by-day
// plan with real, named stops (places, viewpoints, hotels, restaurants).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StyleValue = z.enum(["fastest", "scenic", "curvy", "photo", "tourist", "cruise"]);

const InputSchema = z.object({
  origin: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
  days: z.number().int().min(1).max(21),
  roundTrip: z.boolean().optional().default(false),
  waypoints: z.array(z.string().min(1).max(120)).max(10).optional().default([]),
  vehicleLabel: z.string().min(1).max(80),
  energyLabel: z.string().max(80).optional().default(""),
  styleLabel: z.string().min(1).max(80),
  styleValue: StyleValue.optional(),
  maxHoursPerDay: z.number().int().min(2).max(14).optional().default(6),
  stopInterests: z.array(z.string()).max(20).optional().default([]),
  avoidHighway: z.boolean().optional().default(false),
  language: z.string().max(8).optional().default("nb"),
});

const STYLE_RULES: Record<z.infer<typeof StyleValue>, string> = {
  fastest:
    "STYLE=FASTEST: minimize detours, fewer stops (2-3 per day), prefer main roads/motorway, shortest reasonable driving time. Stops should be practical (fuel, food, brief rest).",
  scenic:
    "STYLE=SCENIC: prefer known scenic corridors, fjords, mountain passes and Nasjonale Turistveier. Add viewpoints. Avoid motorway where reasonable. 3-5 stops per day with strong landscape value.",
  curvy:
    "STYLE=CURVY: prefer motorcycle-friendly roads, mountain passes, coastal roads and roads known for driving enjoyment (e.g. Trollstigen, Aurlandsfjellet, Gamle Strynefjellsvegen, Atlanterhavsveien). Avoid long motorway stretches. Fewer but better stops emphasizing the road itself.",
  photo:
    "STYLE=PHOTO: prioritize viewpoints, photo stops, golden-hour places, waterfalls, fjords, mountain views. Shorter daily driving sections so there is time to stop. 4-6 stops per day, weighted toward type=viewpoint/photo.",
  tourist:
    "STYLE=TOURIST: prioritize attractions, local experiences, Nasjonale Turistveier and iconic stops. Mix attraction/experience/viewpoint stop types. Include well-known landmarks.",
  cruise:
    "STYLE=CRUISE: prioritize comfort, manageable driving days (well below the max), food/coffee/rest stops, easy logistics. Avoid demanding mountain passes back-to-back.",
};

export type AiStopType =
  | "viewpoint" | "photo" | "food" | "lodging" | "fuel"
  | "attraction" | "rest" | "city" | "experience";

export interface AiPlanStop {
  name: string;
  type: AiStopType;
  description: string;
  durationMin: number;
}
export interface AiPlanDay {
  dayNumber: number;
  start: string;
  end: string;
  summary: string;
  drivingMinutes: number;
  lodging?: string;
  stops: AiPlanStop[];
}
export interface AiPlanResult {
  days: AiPlanDay[];
  summary?: string;
}

const TOOL_NAME = "return_trip_plan";

function buildSystemPrompt(language: string) {
  const lang = language === "en" ? "English" : language === "de" ? "German"
    : language === "sv" ? "Swedish" : language === "da" ? "Danish"
    : language === "nl" ? "Dutch" : "Norwegian (Bokmål)";
  return `You are a Norwegian road-trip planner. You know Norway's geography, scenic routes (Nasjonale Turistveier), fjords, mountain passes, named viewpoints and well-known hotels intimately. Always respond in ${lang}.

You MUST return a complete day-by-day plan with real, named, well-known places. Never invent fake names. Examples of good stops: "Atlanterhavsveien", "Trollstigen utsiktspunkt", "Geiranger Skywalk", "Scandic Molde", "Bakeriet i Lom".

Rules:
- Every day MUST have at least 2 named stops (3-5 is ideal).
- Use real Norwegian place names, attractions, restaurants, viewpoints.
- For lodging days suggest a real hotel chain (Scandic, Thon, Quality, Comfort, Clarion, Radisson) or known camping/cabin in that area.
- Driving minutes per day must respect the user's max-hours limit.
- Distribute the route logically — don't backtrack. For round trips, return on a different route where possible.
- Each stop needs: name, type, one-sentence description, durationMin (15-180).`;
}

function buildUserPrompt(d: z.infer<typeof InputSchema>) {
  const waypointLine = d.waypoints.length
    ? `Must pass through: ${d.waypoints.join(", ")}.`
    : "No required waypoints — choose the best route.";
  const tripShape = d.roundTrip
    ? `Round trip: start in ${d.origin}, visit ${d.destination}, return to ${d.origin} by day ${d.days}.`
    : `One-way: ${d.origin} → ${d.destination} over ${d.days} day(s).`;
  return [
    `Plan a ${d.days}-day road trip.`,
    tripShape,
    waypointLine,
    `Vehicle: ${d.vehicleLabel}${d.energyLabel ? ` (${d.energyLabel})` : ""}.`,
    `Style: ${d.styleLabel}.`,
    `Max driving per day: ${d.maxHoursPerDay} hours.`,
    d.avoidHighway ? "Avoid motorways where possible." : "",
    d.stopInterests.length ? `Preferred stop types: ${d.stopInterests.join(", ")}.` : "",
    "",
    "Return a plan with EVERY day filled. Distribute the waypoints sensibly. For example, on a 9-day Drammen → Molde round trip include Atlanterhavsveien, Trollstigen, Geirangerfjord area and similar real attractions.",
  ].filter(Boolean).join("\n");
}

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayNumber: { type: "integer", minimum: 1 },
          start: { type: "string" },
          end: { type: "string" },
          summary: { type: "string" },
          drivingMinutes: { type: "integer", minimum: 0, maximum: 900 },
          lodging: { type: "string" },
          stops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ["viewpoint", "photo", "food", "lodging", "fuel", "attraction", "rest", "city", "experience"] },
                description: { type: "string" },
                durationMin: { type: "integer", minimum: 10, maximum: 300 },
              },
              required: ["name", "type", "description", "durationMin"],
              additionalProperties: false,
            },
            minItems: 2,
            maxItems: 6,
          },
        },
        required: ["dayNumber", "start", "end", "summary", "drivingMinutes", "stops"],
        additionalProperties: false,
      },
    },
  },
  required: ["days"],
  additionalProperties: false,
} as const;

export const generateAiTripPlanFn = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ plan: AiPlanResult | null; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { plan: null, error: "AI gateway not configured" };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt(data.language) },
          { role: "user", content: buildUserPrompt(data) },
        ],
        tools: [{
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Return the structured day-by-day trip plan.",
            parameters: TOOL_SCHEMA,
          },
        }],
        tool_choice: { type: "function", function: { name: TOOL_NAME } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { plan: null, error: "rate_limited" };
      if (res.status === 402) return { plan: null, error: "credits_exhausted" };
      const body = await res.text().catch(() => "");
      console.error("[trip-ai-plan] gateway error", res.status, body);
      return { plan: null, error: `Gateway error ${res.status}` };
    }

    const payload = await res.json() as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }>;
    };
    const msg = payload.choices?.[0]?.message as { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>; content?: string } | undefined;
    let argsRaw = msg?.tool_calls?.find((c) => c.function?.name === TOOL_NAME)?.function?.arguments;
    if (!argsRaw && msg?.content) {
      // Fallback: some models return JSON in `content` instead of calling the tool.
      argsRaw = msg.content.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/im, "").trim();
    }
    if (!argsRaw) {
      console.error("[trip-ai-plan] no tool call and no text content in response");
      return { plan: null, error: "no_tool_call" };
    }

    try {
      const parsed = JSON.parse(argsRaw);
      const Schema = z.object({
        summary: z.string().optional(),
        days: z.array(z.object({
          dayNumber: z.number().int().min(1),
          start: z.string(),
          end: z.string(),
          summary: z.string(),
          drivingMinutes: z.number().int().min(0).max(900),
          lodging: z.string().optional(),
          stops: z.array(z.object({
            name: z.string().min(1),
            type: z.enum(["viewpoint", "photo", "food", "lodging", "fuel", "attraction", "rest", "city", "experience"]),
            description: z.string(),
            durationMin: z.number().int().min(10).max(300),
          })).min(1).max(8),
        })).min(1).max(21),
      });
      const plan = Schema.parse(parsed);
      return { plan };
    } catch (err) {
      console.error("[trip-ai-plan] parse error", err);
      return { plan: null, error: "parse_error" };
    }
  });
