// AI-powered trip import: parse free-form travel text into structured stops.
// Calls the Lovable AI Gateway with tool calling to guarantee a JSON schema response.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(3).max(8000),
});

export interface ImportedStop {
  name: string;
  date: string | null;        // ISO YYYY-MM-DD if mentioned, else null
  dayNumber: number;          // 1-based ordinal
  type: "lodging" | "city" | "waypoint";
  notes?: string;
}

const TOOL_NAME = "return_stops";

const SYSTEM_PROMPT = `You are a travel-plan parser. Read the user's text — which may be Norwegian, English, Swedish, Danish, Dutch, or German — and extract an ordered list of travel stops.

Rules:
- Preserve the order the user wrote them in.
- "dayNumber" starts at 1 for the first stop, then 2, 3, ... Stops on the same calendar date share the same dayNumber.
- "date" must be ISO YYYY-MM-DD if a specific date is mentioned (assume the next future occurrence when the year is missing). Otherwise null.
- "type" must be "lodging" if the place name is clearly a hotel/camping/B&B/known chain (Scandic, Thon, Radisson, Comfort, Quality, Clarion, Hilton, Marriott, etc.) — otherwise "city" for cities/towns and "waypoint" for landmarks/POIs.
- Keep "name" close to the user's original spelling.
- Add a short "notes" string only when the user gave extra info (room number, party size, "to lunsj med Per", etc.).
- Return an empty list if no stops can be extracted.`;

export const importTripFromTextFn = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ stops: ImportedStop[]; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { stops: [], error: "AI gateway not configured" };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: TOOL_NAME,
              description: "Return the parsed list of trip stops.",
              parameters: {
                type: "object",
                properties: {
                  stops: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        date: { type: ["string", "null"] },
                        dayNumber: { type: "integer", minimum: 1 },
                        type: { type: "string", enum: ["lodging", "city", "waypoint"] },
                        notes: { type: "string" },
                      },
                      required: ["name", "dayNumber", "type"],
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
        tool_choice: { type: "function", function: { name: TOOL_NAME } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) return { stops: [], error: "rate_limited" };
      if (res.status === 402) return { stops: [], error: "credits_exhausted" };
      const body = await res.text().catch(() => "");
      console.error("[trip-import] gateway error", res.status, body);
      return { stops: [], error: `Gateway error ${res.status}` };
    }

    const payload = await res.json() as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };

    const call = payload.choices?.[0]?.message?.tool_calls?.find((c) => c.function?.name === TOOL_NAME);
    const argsRaw = call?.function?.arguments;
    if (!argsRaw) return { stops: [], error: "no_tool_call" };

    try {
      const parsed = JSON.parse(argsRaw) as { stops?: unknown };
      const Stops = z.array(z.object({
        name: z.string().min(1),
        date: z.string().nullable().optional().transform((v) => v ?? null),
        dayNumber: z.number().int().min(1),
        type: z.enum(["lodging", "city", "waypoint"]),
        notes: z.string().optional(),
      })).max(50);
      const stops = Stops.parse(parsed.stops ?? []);
      return { stops };
    } catch (err) {
      console.error("[trip-import] parse error", err);
      return { stops: [], error: "parse_error" };
    }
  });
