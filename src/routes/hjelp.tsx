import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search } from "lucide-react";
import { HelpBot } from "@/components/HelpBot";
import { VeigledeLogo } from "@/components/VeigledeLogo";

export const Route = createFileRoute("/hjelp")({
  head: () => ({
    meta: [
      { title: "Hjelp og svar — Veiglede" },
      {
        name: "description",
        content:
          "Finn svar på de vanligste spørsmålene om Veiglede — turplanlegging, GPS-eksport, deling, abonnement og personvern.",
      },
      { property: "og:title", content: "Hjelp og svar — Veiglede" },
      { property: "og:description", content: "Vanlige spørsmål om Veiglede roadtrip-planlegger." },
    ],
  }),
  component: HjelpPage,
});

type FaqItem = { q: string; a: string };
type FaqSection = { title: string; items: FaqItem[] };

const SECTIONS: FaqSection[] = [
  {
    title: "Komme i gang",
    items: [
      {
        q: "Hvordan oppretter jeg en konto?",
        a: "Klikk 'Mine turer' eller 'Start ny tur' og logg inn med Google. Det er gratis.",
      },
      {
        q: "Hvordan planlegger jeg min første tur?",
        a: "Klikk '+ Ny tur', skriv inn start og destinasjon, velg kjøretøy og dato. AI genererer roadbooken automatisk.",
      },
      {
        q: "Må jeg laste ned en app?",
        a: "Nei — Veiglede fungerer direkte i nettleseren. Du kan installere den på hjemskjermen via banneret som dukker opp på mobil.",
      },
    ],
  },
  {
    title: "Turplanlegging",
    items: [
      {
        q: "Kan jeg planlegge en flersdagerstur?",
        a: "Ja. Etter at turen er laget kan du trykke 'Del opp i flere dager' for å fordele stoppene over flere dager med egne avreisetider.",
      },
      {
        q: "Hvordan legger jeg til overnatting?",
        a: "Trykk '+ Legg til stopp' på dagen og velg type 'Overnatting'. Du kan legge til pris per natt og booking-status.",
      },
      {
        q: "Oppdager Veiglede ferjer automatisk?",
        a: "Ja — ferjestrekninger langs ruten legges inn som ⛴️-stopp automatisk. Du kan legge til billettpris manuelt.",
      },
      {
        q: "Kan jeg endre stopp etter at turen er laget?",
        a: "Ja. Hver tur kan redigeres når som helst — flytt stopp mellom dager, endre tid, legg til notater og bilder.",
      },
      {
        q: "Hvordan deler jeg turen med reisefølget?",
        a: "Trykk 'Del tur' og inviter via e-post. Reisefølget kan se og redigere roadbooken sammen med deg.",
      },
    ],
  },
  {
    title: "Navigasjon og GPS",
    items: [
      {
        q: "Hvordan sender jeg ruten til Google Maps?",
        a: "Trykk 'Naviger →' på turen og velg Google Maps. Hele ruten med alle stopp sendes over.",
      },
      {
        q: "Kan jeg bruke Veiglede med CarPlay eller Android Auto?",
        a: "Ikke direkte, men du kan sende ruten til Google Maps som støtter CarPlay og Android Auto.",
      },
      {
        q: "Hvordan eksporterer jeg GPX til Garmin eller BMW Navigator?",
        a: "Åpne roadbooken og trykk 'Last ned GPX'. Filen er optimalisert for Garmin og BMW Motorrad Navigator.",
      },
    ],
  },
  {
    title: "Deling og sosial",
    items: [
      {
        q: "Hvordan deler jeg en tur offentlig?",
        a: "På turen, åpne 'Del tur' og slå på offentlig deling. Turen vises da på /explore og på din profil.",
      },
      {
        q: "Hva er forskjellen på reisefølge og offentlig deling?",
        a: "Reisefølge er navngitte personer som kan redigere turen. Offentlig deling lar hvem som helst lese den via en lenke.",
      },
      {
        q: "Hvordan fungerer live-deling?",
        a: "På turen, start live-deling. Du får en lenke som viser posisjonen din i sanntid — mottaker trenger ikke app.",
      },
      {
        q: "Kan mottaker følge live-delingen uten konto?",
        a: "Ja — live-lenken fungerer uten innlogging. Send lenken på SMS eller WhatsApp.",
      },
    ],
  },
  {
    title: "Garasje og kjøretøy",
    items: [
      {
        q: "Hvordan legger jeg til et kjøretøy?",
        a: "Gå til /garage og trykk '+ Nytt kjøretøy'. Velg type, navn, og last opp et bilde.",
      },
      {
        q: "Kan jeg ha flere kjøretøy?",
        a: "Ja. Gratis-planen tillater 2 kjøretøy, Pro og Gruppe gir ubegrenset antall.",
      },
      {
        q: "Hva påvirker kjøretøypreferansene?",
        a: "Hver bil/MC/bobil har egne preferanser for rutestil og stopp-interesser, som AI bruker når den planlegger nye turer.",
      },
    ],
  },
  {
    title: "Abonnement og betaling",
    items: [
      {
        q: "Hva er inkludert i gratis-planen?",
        a: "Inntil 10 turer og 2 kjøretøy, grunnleggende AI-roadbook og deling med reisefølge.",
      },
      {
        q: "Hva får jeg med Pro?",
        a: "Ubegrenset antall turer og kjøretøy, avansert AI, live-deling, PDF- og GPX-eksport. 79 kr/mnd.",
      },
      {
        q: "Hva er Gruppe-planen og hvem passer den for?",
        a: "Alt i Pro pluss opptil 20 medlemmer i en delt arbeidsflate — perfekt for MC-klubber og turlag. 199 kr/mnd.",
      },
      {
        q: "Hvordan avslutter jeg abonnementet?",
        a: "Gå til Profil → Abonnement og trykk 'Avslutt'. Du beholder Pro-funksjonene ut perioden.",
      },
    ],
  },
  {
    title: "Personvern",
    items: [
      {
        q: "Hvilke data lagrer Veiglede?",
        a: "Bare det du selv legger inn: turer, kjøretøy, stopp og bilder. Vi lagrer ikke posisjonen din uten samtykke.",
      },
      {
        q: "Kan jeg slette kontoen min?",
        a: "Ja — gå til Profil → Konto og data → Slett konto. Alle data slettes umiddelbart.",
      },
      {
        q: "Deles dataene mine med annonsører?",
        a: "Nei — vi deler aldri persondata. Kun anonymisert statistikk hvis du har samtykket til det.",
      },
    ],
  },
];

function HjelpPage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
      ),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-5 flex items-center justify-between">
          <Link to="/" aria-label="Veiglede">
            <VeigledeLogo size="md" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Tilbake
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-6 py-10">
        <p className="text-xs uppercase tracking-[0.28em] text-primary font-semibold">Hjelp og svar</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Finn svar på de vanligste spørsmålene</h1>
        <p className="mt-3 text-muted-foreground">
          Eller chat med vår hjelpe-bot nede i hjørnet — den svarer umiddelbart.
        </p>

        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i hjelp…"
            className="w-full rounded-2xl border border-border bg-surface pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="mt-8 space-y-8">
          {filtered.length === 0 && (
            <p className="text-muted-foreground">Ingen treff. Prøv et annet søkeord, eller spør boten.</p>
          )}
          {filtered.map((section) => (
            <section key={section.title}>
              <h2 className="text-xs uppercase tracking-[0.24em] font-semibold text-muted-foreground mb-3">
                {section.title}
              </h2>
              <Accordion type="multiple" className="rounded-2xl border border-border bg-surface divide-y divide-border">
                {section.items.map((it, i) => (
                  <AccordionItem key={i} value={`${section.title}-${i}`} className="border-0 px-4">
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                      {it.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{it.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-surface-2/40 p-5 text-sm">
          <p className="font-semibold">Finner du ikke svaret?</p>
          <p className="mt-1 text-muted-foreground">
            Send oss en e-post på{" "}
            <a href="mailto:kontakt@veiglede.no" className="text-primary underline">
              kontakt@veiglede.no
            </a>
            , eller chat med hjelpe-boten nede i hjørnet.
          </p>
        </div>
      </main>

      <HelpBot />
    </div>
  );
}
