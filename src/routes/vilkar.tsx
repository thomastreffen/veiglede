import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";

export const Route = createFileRoute("/vilkar")({
  head: () => ({
    meta: [
      { title: "Brukervilkår — Veiglede" },
      { name: "description", content: "Vilkår for bruk av Veiglede — AI-drevet roadtrip-planlegger for norske veier." },
      { property: "og:title", content: "Brukervilkår — Veiglede" },
      { property: "og:description", content: "Vilkår for bruk av Veiglede." },
    ],
  }),
  component: VilkarPage,
});

function VilkarPage() {
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
        <h1 className="font-display text-4xl md:text-5xl mb-2">Brukervilkår</h1>
        <p className="text-sm text-muted-foreground">Sist oppdatert: 1. juni 2026</p>

        <p className="mt-6">
          Disse vilkårene regulerer din bruk av Veiglede. Ved å opprette en konto eller bruke tjenesten godtar du
          vilkårene.
        </p>

        <h2 className="mt-10">1. Tjenestebeskrivelse</h2>
        <p>
          Veiglede er en AI-drevet planlegger for roadtrips på norske veier. Tjenesten lar deg planlegge ruter,
          lagre kjøretøy, dele turer og motta forslag til stopp og fordeler underveis.
        </p>

        <h2 className="mt-10">2. Brukerens ansvar</h2>
        <ul>
          <li>Du er ansvarlig for innholdet du publiserer og deler.</li>
          <li>Du skal ikke dele upassende, ulovlig, krenkende eller villedende innhold.</li>
          <li>Du skal ikke misbruke tjenesten eller forsøke å omgå sikkerhetstiltak.</li>
        </ul>

        <h2 className="mt-10">3. Intellektuell eiendom</h2>
        <p>
          Veiglede eier alle rettigheter til plattformen, inkludert design, kildekode, varemerker og AI-modeller.
          Du beholder rettighetene til ditt eget innhold (turer, notater, bilder), men gir Veiglede en ikke-eksklusiv
          rett til å lagre og vise innholdet som nødvendig for å levere tjenesten.
        </p>

        <h2 className="mt-10">4. Abonnement og betaling</h2>
        <p>
          Veiglede tilbyr en gratisplan samt betalte planer (Pro og Gruppe). Abonnement faktureres månedlig og
          fornyes automatisk inntil det sies opp. Du kan si opp når som helst fra innstillingene; tilgang varer ut
          inneværende periode. Refusjon gis ikke for delvis benyttede perioder med mindre annet følger av ufravikelig
          forbrukerlovgivning.
        </p>

        <h2 className="mt-10">5. Partner-avtaler</h2>
        <p>
          Partnere kan registrere virksomheter, fordeler og kampanjer i tjenesten. Partner-avtaler reguleres av egne
          vilkår som aksepteres ved registrering i partnerportalen. Veiglede er ikke part i transaksjoner mellom
          bruker og partner.
        </p>

        <h2 className="mt-10">6. Ansvarsbegrensning</h2>
        <p>
          AI-forslag, ruter, stopp og fordeler er veiledende. Veiglede gir ingen garanti for veisikkerhet, åpningstider,
          tilgjengelighet eller riktigheten av ekstern informasjon. Du er selv ansvarlig for trygg kjøring og for å
          følge gjeldende trafikkregler. Veiglede er ikke ansvarlig for indirekte tap eller følgeskader så langt
          loven tillater.
        </p>

        <h2 className="mt-10">7. Endringer i vilkårene</h2>
        <p>
          Vi kan oppdatere vilkårene. Vesentlige endringer varsles via tjenesten eller på e-post i god tid før de
          trer i kraft. Fortsatt bruk etter ikrafttredelse innebærer aksept av oppdaterte vilkår.
        </p>

        <h2 className="mt-10">8. Lovvalg og verneting</h2>
        <p>
          Vilkårene reguleres av norsk rett. Tvister søkes løst i minnelighet. Dersom enighet ikke oppnås, er Oslo
          tingrett verneting.
        </p>

        <h2 className="mt-10">9. Kontakt</h2>
        <p>
          Spørsmål om vilkårene: <a href="mailto:kontakt@veiglede.no">kontakt@veiglede.no</a>.
        </p>
      </main>
    </div>
  );
}
