import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";

export const Route = createFileRoute("/personvern")({
  head: () => ({
    meta: [
      { title: "Personvernerklæring — Veiglede" },
      { name: "description", content: "Hvordan Veiglede samler inn, bruker og beskytter dine personopplysninger i tråd med GDPR." },
      { property: "og:title", content: "Personvernerklæring — Veiglede" },
      { property: "og:description", content: "Veiglede sin GDPR-kompatible personvernerklæring." },
    ],
  }),
  component: PersonvernPage,
});

function PersonvernPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-surface">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <VeigledeLogo size="sm" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Tilbake
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-12 prose prose-neutral dark:prose-invert">
        <h1 className="font-display text-4xl md:text-5xl mb-2">Personvernerklæring</h1>
        <p className="text-sm text-muted-foreground">Sist oppdatert: 1. juni 2026</p>

        <p className="mt-6">
          Veiglede ("vi", "oss") er opptatt av å beskytte personvernet ditt. Denne erklæringen forklarer hvilke
          personopplysninger vi samler inn, hvordan vi bruker dem, og hvilke rettigheter du har etter
          personvernforordningen (GDPR).
        </p>

        <h2 className="mt-10">1. Behandlingsansvarlig</h2>
        <p>
          Veiglede er behandlingsansvarlig for personopplysningene som behandles gjennom tjenesten.
          Henvendelser kan sendes til <a href="mailto:kontakt@veiglede.no">kontakt@veiglede.no</a>.
        </p>

        <h2 className="mt-10">2. Hvilke data vi samler inn</h2>
        <ul>
          <li><strong>Kontodata:</strong> navn og e-postadresse, innhentet via Google OAuth ved innlogging.</li>
          <li><strong>Kjøretøydata:</strong> type kjøretøy, drivstoff og preferanser du selv registrerer.</li>
          <li><strong>Turdata:</strong> ruter, stopp, distanser og notater knyttet til turer du planlegger.</li>
          <li><strong>Posisjonsdata:</strong> kun når live-deling er aktivert og du har gitt eksplisitt samtykke.</li>
          <li><strong>Bruksdata:</strong> visninger og klikk på partner-stopp og fordeler, brukt til anonym statistikk.</li>
        </ul>

        <h2 className="mt-10">3. Formål med behandlingen</h2>
        <ul>
          <li>Levere kjernetjenesten: planlegge turer, lagre kjøretøy og generere AI-forslag.</li>
          <li>Vise relevante fordeler og partner-stopp — kun dersom du har samtykket til målretting.</li>
          <li>Levere anonymisert statistikk til annonsører — kun med samtykke.</li>
        </ul>

        <h2 className="mt-10">4. Rettslig grunnlag</h2>
        <ul>
          <li><strong>Avtale (GDPR art. 6(1)(b)):</strong> behandling som er nødvendig for å levere tjenesten du har bedt om.</li>
          <li><strong>Samtykke (GDPR art. 6(1)(a)):</strong> målretting av fordeler, posisjonsdeling og anonymisert statistikk til annonsører.</li>
        </ul>

        <h2 className="mt-10">5. Lagring og databehandlere</h2>
        <p>
          Personopplysninger lagres i Supabase (EU-region). AI-genererte forslag produseres ved hjelp av Anthropic
          sitt API; innhold som sendes til AI inneholder kun det som trengs for å generere et svar, og lagres ikke
          permanent av leverandøren utover deres standard retensjon.
        </p>

        <h2 className="mt-10">6. Dine rettigheter</h2>
        <p>Du har rett til:</p>
        <ul>
          <li>Innsyn i hvilke opplysninger vi har om deg</li>
          <li>Retting av feilaktige opplysninger</li>
          <li>Sletting ("retten til å bli glemt")</li>
          <li>Begrensning av behandling og dataportabilitet</li>
          <li>Å trekke tilbake samtykke når som helst</li>
        </ul>
        <p>
          Send forespørsel til <a href="mailto:kontakt@veiglede.no">kontakt@veiglede.no</a>. Du har også rett til å
          klage til Datatilsynet.
        </p>

        <h2 className="mt-10">7. Informasjonskapsler</h2>
        <p>
          Veiglede bruker kun nødvendige informasjonskapsler for innlogging og sesjonshåndtering. Vi bruker ikke
          tracking- eller markedsføringscookies.
        </p>

        <h2 className="mt-10">8. Kontakt</h2>
        <p>
          For spørsmål om personvern: <a href="mailto:kontakt@veiglede.no">kontakt@veiglede.no</a>.
        </p>
      </main>
    </div>
  );
}
