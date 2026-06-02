import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM_PROMPT = `Du er Veiglede-assistenten — en hjelpsom og vennlig support-bot for Veiglede.no, Norges AI-drevne roadtrip-planlegger.

OM VEIGLEDE:
Veiglede hjelper folk planlegge roadtrips i Norge og Europa med AI-genererte roadbooks, smarte stopp og deling med reisefølge.

FUNKSJONER DU KAN HJELPE MED:

Turplanlegging:
- Opprett ny tur via "+ Ny tur" knappen
- Velg start, destinasjon, dato og kjøretøy
- AI genererer roadbook med stopp, kart og reisetid
- Legg til stopp: utsikt, mat, drivstoff, overnatting, ferje, attraksjon
- Del opp i flere dager for lange turer
- Sett avreiseklokkeslett per dag
- Ferjer detekteres automatisk langs ruten

Min garasje (/garage):
- Legg til kjøretøy (bil, MC, bobil)
- Hvert kjøretøy har egne preferanser (rutestil, stopp-interesser)
- Last opp bilde av kjøretøyet
- Se km-statistikk per kjøretøy

Navigasjon:
- Trykk "Naviger →" på turen for å sende ruten til Google Maps, Apple Maps eller Waze
- Last ned GPX-fil for Garmin og BMW Motorrad Navigator
- Google Maps støtter CarPlay og Android Auto

Dele turer:
- "Del tur" knappen genererer en delingslenke
- Inviter reisefølge via e-post — de kan se og redigere roadbooken
- Live-deling: del posisjonen din i sanntid — ingen app nødvendig for mottaker
- Offentlige turer vises på /explore og din offentlige profil

Roadbook:
- Dag-for-dag oversikt med kart og stopp
- OVERSIKT-fane viser tidslinje, kostnad per dag og ferjer
- Eksporter til PDF for utskrift
- Eksporter til GPX for GPS-enheter

Pakkeliste:
- Automatiske forslag basert på kjøretøy og rute
- AI-forslag via "Forslag fra AI"-knappen
- Organiser i kategorier (klær, utstyr, dokumenter, mat)

Kostnadskalkulator:
- Beregner drivstoff/lading, bom, ferje og overnatting
- Per-person fordeling
- Vises i turregnskap på hver tur

Profil og sosial:
- Offentlig profil på veiglede.no/u/[brukernavn]
- Følg andre brukere og se turene deres
- Reager på turer (🔥 👏 📍)
- Lagre andres turer til din egen planlegger

Veiglede Fordeler (/fordeler):
- Eksklusive rabatter på MC-utstyr, verksted, forsikring
- Aktiver i profil → Personvern og samtykke
- Kopier rabattkoden og gå til leverandørens nettside

Abonnement:
- Gratis: 10 turer, 2 kjøretøy
- Pro (79 kr/mnd): ubegrenset, avansert AI, live-deling, PDF/GPX
- Gruppe (199 kr/mnd): alt i Pro + opptil 20 medlemmer, perfekt for MC-klubber
- Se /pricing for full oversikt

Teknisk:
- Veiglede fungerer i nettleseren — ingen app nødvendig
- Kan installeres på hjemskjermen (PWA) via banneret på mobil
- Støtter norsk, engelsk, tysk, nederlandsk, svensk og dansk
- Data synkroniseres mellom enheter når du er innlogget

REGLER:
- Svar alltid på samme språk som brukeren skriver på
- Vær konkret og kort — maks 3-4 setninger per svar
- Hvis du ikke vet svaret, si "Det vet jeg ikke sikkert — kontakt oss på kontakt@veiglede.no"
- Ikke oppfordre til å kontakte support for enkle spørsmål du kan svare på
- Lenk til relevante sider når det er naturlig: /trips, /garage, /fordeler, /pricing, /settings
- Aldri nevn konkurrenter`;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const helpBotChatFn = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: { role: "user" | "assistant"; content: string }[] }) =>
    z.object({ messages: z.array(MessageSchema).min(1).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { reply: "Hjelpe-boten er ikke konfigurert ennå. Prøv igjen om litt." };
    }

    const recent = data.messages.slice(-10);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: recent,
        }),
      });

      if (res.status === 429) return { reply: "Boten er litt sliten akkurat nå — prøv igjen om et øyeblikk." };
      if (res.status === 402) return { reply: "AI-kvoten er brukt opp. Kontakt support på kontakt@veiglede.no." };

      if (!res.ok) {
        const t = await res.text();
        console.error("HelpBot Anthropic error", res.status, t);
        return { reply: "Beklager — noe gikk galt. Prøv igjen, eller kontakt kontakt@veiglede.no." };
      }

      const json = await res.json();
      const reply: string =
        json?.content?.[0]?.text ??
        "Det vet jeg ikke sikkert — kontakt oss på kontakt@veiglede.no.";
      return { reply };
    } catch (err) {
      console.error("HelpBot chat failed", err);
      return { reply: "Beklager — noe gikk galt. Prøv igjen senere." };
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
