import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Sparkles, BookOpen, MapPin, Mountain, Compass, Share2, Car, Route as RouteIcon } from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { useAuth } from "@/lib/auth";
import heroFjord from "@/assets/hero-fjord.jpg";
import routeLofoten from "@/assets/route-lofoten.jpg";
import routeAtlanterhavsveien from "@/assets/route-atlanterhavsveien.jpg";
import routeHardanger from "@/assets/route-hardanger.jpg";
import routeSognefjellet from "@/assets/route-sognefjellet.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veiglede — AI-drevet roadtrip-planlegger for Norge" },
      {
        name: "description",
        content:
          "Veiglede planlegger den gode veien gjennom Norge — sceniske ruter, minneverdige stopp og AI-drevne forslag tilpasset deg og kjøretøyet ditt.",
      },
      { property: "og:title", content: "Veiglede — Finn veien som betyr noe" },
      {
        property: "og:description",
        content:
          "AI-drevet veiplanlegging for naturopplevelser, minneverdige stopp og den gode veien.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

const features = [
  { Icon: Mountain, title: "Sceniske ruter", body: "Håndplukkede veier gjennom Norges vakreste landskap." },
  { Icon: MapPin, title: "Minneverdige stopp", body: "Skjulte perler og opplevelser utenfor allfarvei." },
  { Icon: Sparkles, title: "AI-drevne forslag", body: "Smarte anbefalinger tilpasset interessene dine." },
  { Icon: BookOpen, title: "Roadbook", body: "Detaljert reiseplan med kart, stopp og høydepunkter." },
  { Icon: Compass, title: "Lokale tips", body: "Innsikt fra folk som faktisk kjenner veien." },
];

const steps = [
  { Icon: Car, title: "Velg kjøretøy og kjørestil", body: "Fortell oss hvordan du liker å kjøre — bil, MC eller bobil." },
  { Icon: RouteIcon, title: "Få rute og stoppforslag", body: "AI bygger en rute med stopp som faktisk passer deg." },
  { Icon: Share2, title: "Åpne roadbook og del turen", body: "Ta med roadbooken på veien, eller del den med reisefølget." },
];

const routes = [
  { img: routeLofoten, name: "Lofoten rundt", meta: "7 dager · 620 km · 22 stopp" },
  { img: routeAtlanterhavsveien, name: "Atlanterhavsveien", meta: "3 dager · 280 km · 12 stopp" },
  { img: routeHardanger, name: "Hardanger rundt", meta: "4 dager · 340 km · 16 stopp" },
  { img: routeSognefjellet, name: "Sognefjellet", meta: "2 dager · 180 km · 9 stopp" },
];

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 md:px-6 py-5 md:py-6">
          <Link to="/" aria-label="Veiglede" className="transition-opacity hover:opacity-90">
            <VeigledeLogo size="lg" tone="light" />
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/trips" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
                Mine turer <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex items-center text-sm font-medium text-white/85 hover:text-white px-3 py-2">
                  Logg inn
                </Link>
                <Link to="/trips/new" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
                  Start ny tur <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate min-h-[92vh] flex items-end overflow-hidden">
        <img
          src={heroFjord}
          alt="Svingete vei langs en norsk fjord i gyllen kveldssol"
          width={1920}
          height={1080}
          className="absolute inset-0 h-full w-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1620]/90 via-[#0F1620]/45 to-[#0F1620]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F1620]/85 via-[#0F1620]/20 to-transparent" />

        <div className="relative mx-auto max-w-6xl w-full px-4 md:px-6 pb-20 md:pb-28 pt-36 md:pt-40 text-white">
          <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-primary">
            <span className="inline-block h-px w-10 bg-primary" /> AI-drevet roadtrip-planlegger
          </p>
          <h1 className="mt-7 font-display uppercase text-balance leading-[0.92] text-[13vw] sm:text-7xl md:text-[6.75rem] max-w-4xl">
            Finn veien <br />
            <span className="text-primary">som betyr noe</span>
          </h1>
          <p className="mt-7 max-w-xl text-base md:text-lg text-white/80 leading-relaxed">
            AI-drevet veiplanlegging for naturopplevelser, minneverdige stopp og den gode veien.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <Link to="/trips/new" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25">
              <Plus className="h-4 w-4" strokeWidth={3} /> Start ny tur
            </Link>
            <Link to="/trips" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 backdrop-blur px-6 py-4 text-sm font-medium text-white hover:bg-white/10 transition-colors">
              Utforsk ruter <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-6 text-xs md:text-sm text-white/70 max-w-md leading-relaxed">
            <span className="text-primary">●</span> Prøv uten konto. Logg inn når du vil lagre, dele eller fortsette senere.
          </p>
        </div>
      </section>



      {/* Feature strip */}
      <section className="border-y border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-12 md:py-16 grid gap-10 md:gap-0 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-border/70">
          {features.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="group flex flex-col lg:px-7 first:lg:pl-0 last:lg:pr-0 transition-colors"
            >
              <span className="inline-grid place-items-center h-11 w-11 rounded-xl bg-primary/15 text-primary ring-1 ring-primary/10 transition-all group-hover:bg-primary/25 group-hover:ring-primary/30 group-hover:-translate-y-0.5">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-base uppercase tracking-wide">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="inline-block h-px w-10 bg-primary" /> Slik fungerer det
            </p>
            <h2 className="mt-4 font-display text-4xl md:text-6xl uppercase leading-[0.98]">
              Planlegg reisen din i <span className="text-primary">noen få enkle steg</span>
            </h2>
          </div>
          <p className="text-sm text-muted-foreground md:max-w-xs">
            Fra første idé til ferdig roadbook på under et minutt — bygget for folk som faktisk skal ut og kjøre.
          </p>
        </div>
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map(({ Icon, title, body }, i) => (
            <li
              key={title}
              className="group relative rounded-3xl border border-border bg-surface p-7 md:p-8 transition-all hover:border-primary/40 hover:-translate-y-1 hover:bg-surface-2/60"
            >
              <span className="absolute top-6 right-7 font-display text-3xl text-primary/30 group-hover:text-primary/60 transition-colors">
                0{i + 1}
              </span>
              <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-6 font-display text-xl uppercase tracking-wide">{title}</h3>
              <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Suggested routes */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-24 md:py-28">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
                <span className="inline-block h-px w-10 bg-primary" /> Forslag til ruter
              </p>
              <h2 className="mt-4 font-display text-4xl md:text-6xl uppercase leading-[0.98]">
                Klassiske norske<br />kjøreopplevelser
              </h2>
            </div>
            <Link to="/trips" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Se alle ruter <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {routes.map((r) => (
              <Link
                key={r.name}
                to="/trips/new"
                className="group overflow-hidden rounded-3xl border border-border bg-surface relative transition-all hover:border-primary/40 hover:-translate-y-1"
              >
                <div className="aspect-[4/5] overflow-hidden">
                  <img
                    src={r.img}
                    alt={r.name}
                    width={1024}
                    height={768}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">
                    <MapPin className="h-3 w-3" /> Norge
                  </div>
                  <h3 className="mt-2 font-display text-xl uppercase">{r.name}</h3>
                  <p className="mt-1 text-xs text-white/75">{r.meta}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-24 md:py-28">
        <div className="rounded-3xl border border-border bg-surface p-8 md:p-16 bg-glow-orange relative overflow-hidden">
          <div className="max-w-2xl relative">
            <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="inline-block h-px w-10 bg-primary" /> Kom i gang
            </p>
            <h2 className="mt-4 font-display text-3xl md:text-5xl uppercase leading-[1.02]">
              Planlegg første tur <span className="text-primary">gratis</span> — ingen konto nødvendig.
            </h2>
            <p className="mt-5 text-muted-foreground text-base leading-relaxed">
              Test Veiglede direkte i nettleseren. Lag konto når du vil lagre turer, synkronisere mellom enheter eller dele roadbooken din.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link to="/trips/new" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" strokeWidth={3} /> Start ny tur
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2/40 px-6 py-4 text-sm font-medium hover:bg-surface-2 transition-colors">
                Logg inn
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <VeigledeLogo size="sm" withTagline />
          <nav className="flex items-center gap-5">
            <Link to="/trips" className="hover:text-foreground">Mine turer</Link>
            <Link to="/trips/new" className="hover:text-foreground">Ny tur</Link>
            <Link to="/login" className="hover:text-foreground">Logg inn</Link>
          </nav>
          <span>© {new Date().getFullYear()} Veiglede</span>
        </div>
      </footer>
    </div>
  );
}
