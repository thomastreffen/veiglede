import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Plus,
  Sparkles,
  BookOpen,
  MapPin,
  Mountain,
  Users,
  Camera,
  Car,
  Bike,
  Caravan,
  Route as RouteIcon,
  Share2,
  Radio,
  Image as ImageIcon,
  Star,
  Smartphone,
  WifiOff,
  Shield,
  Heart,
  Check,
  ChevronRight,
} from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { useAuth } from "@/lib/auth";
import heroFjord from "@/assets/hero-fjord.jpg";
import routeLofoten from "@/assets/route-lofoten.jpg";
import routeAtlanterhavsveien from "@/assets/route-atlanterhavsveien.jpg";
import routeHardanger from "@/assets/route-hardanger.jpg";
import routeTrollstigen from "@/assets/route-trollstigen.jpg";
import routeSognefjellet from "@/assets/route-sognefjellet.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veiglede — AI-drevet roadtrip-planlegger for Norge" },
      {
        name: "description",
        content:
          "Veiglede er din AI-drevne turplanlegger for uforglemmelige roadtrips i Norge. Få optimale ruter, oppdag skjulte perler og planlegg alene eller sammen.",
      },
      { property: "og:title", content: "Veiglede — Finn veien som betyr noe" },
      {
        property: "og:description",
        content:
          "AI-drevet roadtrip-planlegger for Norge. Ruter, stopp, roadbook og fellestur — alt på ett sted.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

const navLinks = [
  { label: "Utforsk ruter", to: "#ruter" },
  { label: "Roadbook", to: "#roadbook" },
  { label: "Planlegg sammen", to: "#sammen" },
  { label: "AI-verktøy", to: "#ai" },
  { label: "Inspirasjon", to: "#inspirasjon" },
];

const heroBullets = [
  "Optimal ruteplanlegging",
  "Skjulte perler",
  "Sammen er bedre",
];

const featureCards = [
  {
    Icon: RouteIcon,
    title: "Optimal turplanlegging",
    body:
      "AI-drevet ruteforslag basert på dine preferanser, interesser, tid og kjøretøy.",
    extra: null as React.ReactNode,
  },
  {
    Icon: Users,
    title: "Felles motorsykkeltur",
    body: "Inviter venner, planlegg sammen og hold følget på veien.",
    extra: (
      <div className="mt-5 flex items-center gap-2">
        <div className="flex -space-x-2">
          {["#f59e0b", "#ef4444", "#3b82f6", "#10b981"].map((c) => (
            <span
              key={c}
              className="h-7 w-7 rounded-full border-2 border-surface"
              style={{ background: c }}
            />
          ))}
        </div>
        <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-semibold">
          +12
        </span>
      </div>
    ),
  },
  {
    Icon: BookOpen,
    title: "Roadbook på veien",
    body:
      "Få en detaljert digital roadbook med sving-for-sving, stopp, tips og severdigheter.",
    extra: null,
  },
];

const steps = [
  {
    Icon: Car,
    n: "01",
    title: "Velg kjøretøy og interesser",
    body: "Fortell oss hva du kjører, hvor du vil, og hva du liker å oppleve.",
  },
  {
    Icon: Sparkles,
    n: "02",
    title: "Få ditt personlige ruteforslag",
    body: "AI lager en optimal rute med stopp som passer deg perfekt.",
  },
  {
    Icon: Mountain,
    n: "03",
    title: "Legg ut på eventyr",
    body: "Følg roadbooken, oppdag nye steder og skap minner for livet.",
  },
];

const popularRoutes = [
  {
    img: routeAtlanterhavsveien,
    name: "Atlanterhavsveien",
    tag: "Klassiker",
    meta: "5 dager · 610 km",
    rating: "4,8",
  },
  {
    img: routeTrollstigen,
    name: "Trollstigen & Geiranger",
    tag: "Naturopplevelser",
    meta: "3 dager · 320 km",
    rating: "4,9",
  },
  {
    img: routeLofoten,
    name: "Lofoten rundt",
    tag: "Eventyr",
    meta: "5 dager · 1150 km",
    rating: "4,9",
  },
  {
    img: routeHardanger,
    name: "Hardangervidda",
    tag: "Skjulte perler",
    meta: "4 dager · 540 km",
    rating: "4,7",
  },
];

const footerBenefits = [
  { Icon: Heart, label: "Lagre turer og favoritter" },
  { Icon: Smartphone, label: "Tilgjengelig på alle enheter" },
  { Icon: WifiOff, label: "Offline roadbook" },
  { Icon: Shield, label: "Trygt og sikkert" },
];

function Landing() {
  const { user } = useAuth();
  const primaryCta = user ? "/trips" : "/trips/new";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 md:px-6 py-3.5">
          <Link to="/" aria-label="Veiglede">
            <VeigledeLogo size="md" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1 text-sm text-muted-foreground">
            {navLinks.map((n) => (
              <a
                key={n.label}
                href={n.to}
                className="px-3 py-2 rounded-full hover:text-foreground hover:bg-surface-2/60 transition-colors"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/trips"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                Mine turer <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2"
                >
                  Logg inn
                </Link>
                <Link
                  to="/trips/new"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                >
                  Start ny tur <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl"
        />
        <div className="mx-auto max-w-7xl px-4 md:px-6 pt-12 md:pt-20 pb-16 md:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left */}
          <div className="relative">
            <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="inline-block h-px w-10 bg-primary" />
              AI-drevet roadtrip-planlegger
            </p>
            <h1 className="mt-6 font-display uppercase leading-[0.92] text-5xl sm:text-6xl md:text-7xl">
              Finn veien som
              <br />
              <span className="text-primary">betyr noe</span>
            </h1>
            <p className="mt-6 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
              Veiglede er din AI-drevne turplanlegger for uforglemmelige
              roadtrips i Norge. Få optimale ruter, oppdag skjulte perler og
              skap minnerike stopp — alene eller sammen med andre.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/trips/new"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25"
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> Planlegg din neste tur
              </Link>
              <a
                href="#ruter"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2/40 px-6 py-4 text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                Utforsk ruter <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {heroBullets.map((b) => (
                <li key={b} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: scenic + route preview card */}
          <div className="relative">
            <div className="relative rounded-3xl overflow-hidden border border-border shadow-2xl shadow-black/40">
              <img
                src={heroFjord}
                alt="Svingete vei langs norsk fjord i kveldslys"
                width={1280}
                height={1280}
                className="h-[520px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-background/85 via-background/10 to-transparent" />

              {/* Floating route panel */}
              <div className="absolute right-4 top-4 sm:right-6 sm:top-6 w-[min(320px,86%)] rounded-2xl border border-border bg-background/85 backdrop-blur p-4 shadow-xl">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="grid place-items-center h-6 w-6 rounded-md bg-primary/15 text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  Din neste tur
                </div>
                <h3 className="mt-3 font-display text-lg uppercase">
                  Åndalsnes → Trollstigen
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {[
                    "Geiranger utsiktspunkt",
                    "Skjulte perler",
                    "Roadbook klar",
                  ].map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background:
                            i === 2 ? "var(--primary)" : "color-mix(in oklab, var(--primary) 60%, transparent)",
                        }}
                      />
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 h-16 rounded-xl bg-surface-2/70 relative overflow-hidden">
                  <svg viewBox="0 0 320 64" className="absolute inset-0 h-full w-full">
                    <path
                      d="M10 50 C 60 10, 110 60, 160 30 S 270 10, 310 28"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                    />
                    {[
                      [20, 48],
                      [120, 38],
                      [220, 22],
                      [300, 28],
                    ].map(([x, y]) => (
                      <circle
                        key={`${x}-${y}`}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="var(--primary)"
                      />
                    ))}
                  </svg>
                  <span className="absolute bottom-1.5 right-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    ~ 12 mil
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 feature cards */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 -mt-2 md:-mt-6 pb-20 md:pb-28">
        <div className="grid gap-5 md:grid-cols-3">
          {featureCards.map(({ Icon, title, body, extra }) => (
            <article
              key={title}
              className="group rounded-3xl border border-border bg-surface p-6 md:p-7 hover:border-primary/40 hover:-translate-y-1 transition-all"
            >
              <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/10">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl uppercase tracking-wide">
                {title}
              </h3>
              <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
                {body}
              </p>
              {extra}
            </article>
          ))}
        </div>
      </section>

      {/* Slik fungerer det */}
      <section id="ai" className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-24 md:py-28 text-center">
          <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
            <span className="inline-block h-px w-10 bg-primary" /> Slik fungerer det
          </p>
          <h2 className="mt-4 font-display text-4xl md:text-6xl uppercase leading-[0.98]">
            Fra idé til ferdig <span className="text-primary">roadbook</span>
          </h2>

          <ol className="mt-14 grid gap-5 md:grid-cols-3 text-left relative">
            {steps.map(({ Icon, n, title, body }, i) => (
              <li
                key={title}
                className="group relative rounded-3xl border border-border bg-surface p-7 hover:border-primary/40 hover:-translate-y-1 transition-all"
              >
                <span className="absolute top-6 right-7 font-display text-3xl text-primary/30 group-hover:text-primary/60 transition-colors">
                  {n}
                </span>
                <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 font-display text-xl uppercase tracking-wide">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
                  {body}
                </p>
                {i < steps.length - 1 && (
                  <ChevronRight
                    className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 text-primary/40"
                    aria-hidden
                  />
                )}
              </li>
            ))}
          </ol>

          <div className="mt-10 flex items-center justify-center gap-5 text-muted-foreground">
            <Bike className="h-7 w-7" />
            <Car className="h-7 w-7" />
            <Caravan className="h-7 w-7" />
          </div>
        </div>
      </section>

      {/* Planlegg alene eller sammen */}
      <section id="sammen" className="mx-auto max-w-7xl px-4 md:px-6 py-24 md:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="inline-block h-px w-10 bg-primary" /> Planlegg alene eller sammen
            </p>
            <h2 className="mt-4 font-display text-4xl md:text-6xl uppercase leading-[0.98]">
              Bedre turer,<br />
              <span className="text-primary">sammen</span>
            </h2>
            <p className="mt-6 text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl">
              Inviter venner, del ideer og planlegg turen sammen. Hold kontakten
              underveis, del opplevelser i sanntid og skap minner dere vil leve
              lenge på.
            </p>
            <ul className="mt-7 space-y-3 text-sm md:text-base">
              {[
                { Icon: Users, t: "Inviter venner og samarbeid om ruten" },
                { Icon: Share2, t: "Del roadbook og stopp med ett klikk" },
                { Icon: Radio, t: "Se hverandre på kartet i sanntid" },
                { Icon: Camera, t: "Del bilder og opplevelser underveis" },
              ].map(({ Icon, t }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 grid place-items-center h-8 w-8 rounded-xl bg-primary/15 text-primary ring-1 ring-primary/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-foreground/90">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Dashboard mockup */}
          <div className="relative">
            <div className="rounded-3xl border border-border bg-surface p-5 md:p-6 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Felles tur
                  </p>
                  <h3 className="mt-1 font-display text-xl uppercase">
                    Vennetur til Lofoten
                  </h3>
                </div>
                <span className="rounded-full bg-primary/15 text-primary px-2.5 py-1 text-[11px] font-semibold">
                  4 reisende
                </span>
              </div>

              <div className="mt-5 grid gap-2">
                {[
                  { name: "Kari", status: "På ruten", color: "#10b981" },
                  { name: "Morten", status: "Ved stopp", color: "#f59e0b" },
                  { name: "Lise", status: "Planlegger", color: "#3b82f6" },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between rounded-xl bg-surface-2/60 border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-semibold text-white"
                        style={{ background: p.color }}
                      >
                        {p.name[0]}
                      </span>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* mini map */}
              <div className="mt-4 h-32 rounded-2xl bg-surface-2/70 relative overflow-hidden border border-border/60">
                <svg viewBox="0 0 400 120" className="absolute inset-0 h-full w-full">
                  <path
                    d="M20 90 C 80 30, 160 110, 220 60 S 340 20, 380 50"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                  />
                </svg>
                {[
                  { left: "18%", top: "62%", c: "#10b981" },
                  { left: "48%", top: "55%", c: "#f59e0b" },
                  { left: "78%", top: "35%", c: "#3b82f6" },
                ].map((m, i) => (
                  <span
                    key={i}
                    className="absolute h-4 w-4 rounded-full border-2 border-background shadow"
                    style={{ left: m.left, top: m.top, background: m.c }}
                  />
                ))}
              </div>

              {/* activity feed */}
              <div className="mt-4 space-y-2">
                {[
                  { Icon: ImageIcon, t: "Kari tok et bilde", when: "nå" },
                  { Icon: MapPin, t: "Morten ankom stoppet", when: "2 min" },
                  { Icon: Plus, t: "Lise la til et nytt stopp", when: "5 min" },
                ].map(({ Icon, t, when }, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-surface-2/50 px-3 py-2 text-sm"
                  >
                    <span className="grid place-items-center h-7 w-7 rounded-lg bg-primary/15 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1 text-foreground/90">{t}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {when}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular routes */}
      <section
        id="ruter"
        className="border-t border-border bg-surface/30"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-24 md:py-28">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
                <span className="inline-block h-px w-10 bg-primary" /> Inspirasjon
              </p>
              <h2 className="mt-4 font-display text-4xl md:text-6xl uppercase leading-[0.98]">
                Utforsk <span className="text-primary">populære ruter</span>
              </h2>
            </div>
            <Link
              to="/trips"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Se alle ruter <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {popularRoutes.map((r) => (
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
                    height={1280}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                <span className="absolute top-3 left-3 rounded-full bg-primary/90 text-primary-foreground text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1">
                  {r.tag}
                </span>
                <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                  <h3 className="font-display text-xl uppercase">{r.name}</h3>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/75">
                    <span>{r.meta}</span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Star className="h-3 w-3 fill-primary" /> {r.rating}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section id="roadbook" className="mx-auto max-w-7xl px-4 md:px-6 py-24 md:py-28">
        <div className="relative rounded-3xl border border-border overflow-hidden">
          <img
            src={routeSognefjellet}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
          <div className="relative p-8 md:p-16 max-w-3xl">
            <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="inline-block h-px w-10 bg-primary" /> Kom i gang
            </p>
            <h2 className="mt-4 font-display text-3xl md:text-5xl uppercase leading-[1.02]">
              Klar for din neste <span className="text-primary">roadtrip?</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-base md:text-lg leading-relaxed">
              Bli med tusenvis av eventyrere som allerede opplever Norge på en
              smartere måte. Gratis å teste — ingen konto nødvendig.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to={primaryCta}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25"
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> Start ny tur nå
              </Link>
              <a
                href="#ruter"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2/60 px-6 py-4 text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                Utforsk ruter <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefit strip */}
      <section className="border-t border-border bg-surface/30">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {footerBenefits.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary/15 text-primary ring-1 ring-primary/10">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-foreground/90">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer id="inspirasjon" className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 flex flex-wrap items-center justify-between gap-6 text-xs text-muted-foreground">
          <VeigledeLogo size="sm" withTagline />
          <nav className="flex items-center gap-5">
            <Link to="/trips" className="hover:text-foreground">
              Mine turer
            </Link>
            <Link to="/trips/new" className="hover:text-foreground">
              Ny tur
            </Link>
            <Link to="/login" className="hover:text-foreground">
              Logg inn
            </Link>
          </nav>
          <span>© {new Date().getFullYear()} Veiglede</span>
        </div>
      </footer>
    </div>
  );
}
