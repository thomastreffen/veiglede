import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `Du er Veiglede-assistenten — en kort, praktisk hjelpe-bot for Veiglede.no, en roadtrip-planlegger.

SVARSTIL:
- Svar alltid på samme språk som brukeren skriver på.
- Hold svar korte og praktiske. Foretrekk trinn-for-trinn.
- Maks 5 punkter. Maks 3-4 setninger hvis prosa.
- Hvis du er usikker, foreslå hva brukeren kan prøve i appen.
- Ikke overlov. Ikke nevn konkurrenter.
- Ikke si "kontakt support" med mindre du virkelig ikke kan hjelpe.

FAKTISKE FUNKSJONER I VEIGLEDE I DAG:

Lage tur:
- Trykk "+ Ny tur" for å starte
- Velg start, mål, dato, kjøretøy og kjørestil
- Legg til stopp, avstikkere og overnatting underveis
- AI hjelper med å foreslå rute og stopp

Roadbook:
- Dag-for-dag oversikt over turen med kart og stopp
- Vis avstand, tid og stoppdetaljer per dag

Navigasjon:
- Hver kjøredag har egne "Naviger dagsetappe"-knapper
- Apple Maps fungerer godt for iPhone-navigasjon av dagsetapper
- Google Maps fungerer best for én dagsetappe eller forhåndsvisning av rute — ikke alltid for hele flerdagsturer
- GPX-eksport for BMW Motorrad Navigator, Garmin, TomTom og andre GPS-enheter/-apper

GPX-eksport (BMW/Garmin/TomTom):
- Åpne turen → "Naviger" → "Last ned GPX"
- Overfør GPX-filen til GPS-enheten eller -appen din
- Fungerer med BMW Motorrad Connected, Garmin Tread/Zumo, TomTom Rider, Kurviger, Calimoto m.fl.

Deling:
- "Del tur" lager en delingslenke
- Du kan velge offentlig eller privat
- Offentlig deling skjuler eksakt privatadresse og viser by/område i stedet
- Privat tur er kun synlig for deg og reisefølget

PWA / installer på hjemskjerm:
- iPhone Safari: Del-knappen → "Legg til på Hjem-skjerm"
- Android Chrome: meny → "Installer app" / "Legg til på startskjerm"
- Appen åpner da i fullskjerm uten nettleserlinje

Garasje (/garage):
- Lagre kjøretøy (bil, MC, bobil) med bilde
- Hvert kjøretøy har egne preferanser (rutestil, interesser)

Hvis bruker spør hvorfor Google Maps ikke starter hele turen:
Svar at Google Maps kan vise hele ruten, men lange flerdagsturer med mange stopp åpnes ofte bare som forhåndsvisning. Anbefal å bruke dagsetappe-knappene for Google Maps, Apple Maps på iPhone, eller GPX for BMW/Garmin/TomTom.

IKKE påstå at følgende fungerer med mindre brukeren selv bekrefter at de ser det:
- Pro-abonnement, live-deling, PDF-eksport, partner-rabatter, følg/sosial. Hvis bruker spør, si at du ikke kan bekrefte status — be dem sjekke i appen.`;

const FALLBACK_REPLY =
  "Jeg fikk ikke kontakt med hjelpeassistenten akkurat nå. Prøv dette: «+ Ny tur» lager ny reise, Roadbook viser dag-for-dag, GPX brukes til BMW/Garmin/TomTom, og «Del» lar deg dele turen trygt (offentlig deling skjuler eksakt adresse).";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const helpBotChatFn = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: { role: "user" | "assistant"; content: string }[] }) =>
    z.object({ messages: z.array(MessageSchema).min(1).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      console.error("[helpbot] LOVABLE_API_KEY missing");
      return { reply: FALLBACK_REPLY };
    }

    const recent = data.messages.slice(-10);

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...recent,
          ],
          max_tokens: 500,
        }),
      });

      if (res.status === 429) {
        return { reply: "Hjelpeassistenten er litt overbelastet akkurat nå. Prøv igjen om et øyeblikk." };
      }
      if (res.status === 402) {
        return { reply: FALLBACK_REPLY };
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("[helpbot] gateway error", res.status, t);
        return { reply: FALLBACK_REPLY };
      }

      const json = await res.json();
      const reply: string | undefined = json?.choices?.[0]?.message?.content;
      if (!reply || typeof reply !== "string" || !reply.trim()) {
        return { reply: FALLBACK_REPLY };
      }
      return { reply: reply.trim() };
    } catch (err) {
      console.error("[helpbot] chat failed", err);
      return { reply: FALLBACK_REPLY };
    }
  });

export const helpBotFeedbackFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    sessionId: string;
    question: string;
    answer: string;
    helpful: boolean;
    feedbackText?: string;
  }) =>
    z
      .object({
        sessionId: z.string().uuid(),
        question: z.string().min(1).max(4000),
        answer: z.string().min(1).max(8000),
        helpful: z.boolean(),
        feedbackText: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("help_bot_feedback").insert({
      session_id: data.sessionId,
      question: data.question,
      answer: data.answer,
      helpful: data.helpful,
      feedback_text: data.feedbackText ?? null,
    });

    if (error) {
      console.error("helpBotFeedback insert failed", error);
      return { ok: false };
    }
    return { ok: true };
  });
