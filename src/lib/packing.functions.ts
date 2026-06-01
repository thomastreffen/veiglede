import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  vehicle: z.string().min(1).max(40),
  style: z.string().min(1).max(40),
  durationDays: z.number().int().min(1).max(60),
  season: z.string().min(1).max(20),
  stopTypes: z.array(z.string().min(1).max(40)).max(40).default([]),
  origin: z.string().max(120).optional(),
  destination: z.string().max(120).optional(),
});

const CATEGORIES = ["klær", "utstyr", "dokumenter", "mat", "annet"] as const;

export interface SuggestedPackingItem {
  label: string;
  category: (typeof CATEGORIES)[number];
}

export const suggestPackingList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ items: SuggestedPackingItem[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Lovable AI is not configured for this project.");
    }

    const system = [
      "Du er en erfaren norsk reiseplanlegger som lager pakkelister på norsk (bokmål).",
      "Returner mellom 12 og 22 konkrete pakkelistelementer, fordelt på kategoriene:",
      "klær, utstyr, dokumenter, mat, annet.",
      "Tilpass listen til kjøretøy, rutestil, varighet, årstid og typer stopp.",
      "Unngå duplikater. Bruk korte, konkrete navn (1–4 ord).",
    ].join(" ");

    const user = [
      `Kjøretøy: ${data.vehicle}`,
      `Rutestil: ${data.style}`,
      `Varighet: ${data.durationDays} dager`,
      `Årstid: ${data.season}`,
      data.origin && data.destination ? `Strekning: ${data.origin} → ${data.destination}` : null,
      data.stopTypes.length ? `Typer stopp: ${data.stopTypes.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_packing_list",
            description: "Returnér en pakkeliste tilpasset turen.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      category: { type: "string", enum: [...CATEGORIES] },
                    },
                    required: ["label", "category"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_packing_list" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("AI er midlertidig overbelastet. Prøv igjen om litt.");
    if (res.status === 402) throw new Error("Lovable AI-kreditt er brukt opp. Legg til kreditt i workspace-innstillingene.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[packing-ai] gateway error", res.status, t);
      throw new Error("Kunne ikke hente AI-forslag.");
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = call?.function?.arguments;
    if (!argsRaw) throw new Error("AI returnerte tomt svar.");

    let parsed: { items?: SuggestedPackingItem[] };
    try {
      parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    } catch {
      throw new Error("Kunne ikke tolke AI-svaret.");
    }

    const items = (parsed.items ?? [])
      .filter((i) => i && typeof i.label === "string" && CATEGORIES.includes(i.category))
      .map((i) => ({ label: i.label.trim().slice(0, 80), category: i.category }))
      .filter((i) => i.label.length > 0)
      .slice(0, 30);

    return { items };
  });
