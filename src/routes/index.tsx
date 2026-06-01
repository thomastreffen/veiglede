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
  User,
  Share2,
  Radio,
  ShieldCheck,
  Route as RouteIcon,
} from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n/provider";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { countPublicProfilesFn } from "@/lib/public-profiles.functions";
import heroFjord from "@/assets/hero-fjord.jpg";
import routeLofoten from "@/assets/route-lofoten.jpg";
import routeAtlanterhavsveien from "@/assets/route-atlanterhavsveien.jpg";
import routeHardanger from "@/assets/route-hardanger.jpg";
import routeSognefjellet from "@/assets/route-sognefjellet.jpg";
import groupMotorcycles from "@/assets/group-motorcycles.jpg";

export const Route = createFileRoute("/")({
  // Static head — SSR runs without a request locale, so we ship the NB
  // defaults. The provider updates document.title client-side after
  // hydration so EN/DE visitors still see the right title in the tab.
  head: () => ({
    meta: [
      { title: "Veiglede — AI-drevet roadtrip-planlegger for Norge" },
      {
        name: "description",
        content:
          "Planlegg den gode turen gjennom Norge — sceniske ruter, minneverdige stopp og roadbook tilpasset deg, kjøretøyet ditt og turfølget.",
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

// Norwegian place names — kept identical across languages.
const POPULAR_ROUTES = [
  { img: routeLofoten, name: "Lofoten rundt", days: 5, km: "~ 850 km", styleKey: "svingete" as const },
  { img: routeAtlanterhavsveien, name: "Atlanterhavsveien", days: 1, km: "~ 160 km", styleKey: "fototur" as const },
  { img: routeHardanger, name: "Hardanger rundt", days: 3, km: "~ 600 km", styleKey: "cruise" as const },
  { img: routeSognefjellet, name: "Sognefjellet", days: 1, km: "~ 235 km", styleKey: "svingete" as const },
];

const FEATURE_ICONS = [Mountain, MapPin, Sparkles, BookOpen, Users];
const WHAT_ICONS = [User, Users, Camera];
const WHAT_IMAGES = [heroFjord, groupMotorcycles, routeHardanger];

function Landing() {
  const { user } = useAuth();
  const t = useT();

  // Keep tab title localized after client hydration.
  if (typeof document !== "undefined") {
    // Cheap idempotent assignment; avoids an extra useEffect.
    if (document.title !== t.meta.title) document.title = t.meta.title;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ============ HERO ============ */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroFjord}
          alt=""
          width={1920}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1118] via-[#0c1118]/85 to-[#0c1118]/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c1118]/40 via-transparent to-[#0c1118]" />

        {/* In-hero header */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 pt-6 md:pt-8 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Veiglede" className="text-white">
            <VeigledeLogo size="md" tone="light" />
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher tone="light" className="hidden sm:inline-flex" />
            {user ? (
              <Link
                to="/trips"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                {t.nav.myTrips} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/85 hover:text-white px-3 py-2">
                  {t.nav.login}
                </Link>
                <Link
                  to="/trips/new"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
                >
                  {t.nav.startTrip}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8 pt-16 md:pt-24 pb-20 md:pb-28 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center text-white">
          <div>
            <p className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-primary">
              <span className="inline-block h-px w-10 bg-primary" />
              {t.hero.eyebrow}
            </p>
            <h1 className="mt-7 font-display uppercase leading-[0.92] text-5xl sm:text-6xl md:text-7xl">
              {t.hero.titleLine1}
              <br />
              {t.hero.titleLine2Prefix}
              <span className="text-primary">{t.hero.titleAccent}</span>
            </h1>
            <p className="mt-7 max-w-xl text-base md:text-lg text-white/80 leading-relaxed">
              {t.hero.body}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/trips/new"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/25"
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> {t.hero.ctaPrimary}
              </Link>
              <a
                href="#ruter"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/5 backdrop-blur px-6 py-4 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                {t.hero.ctaSecondary} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs md:text-sm text-white/75 max-w-md leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary shrink-0" />
              {t.hero.note}
            </p>
            <CommunityCounter />
          </div>

          {/* Right: "Din neste tur" panel */}
          <div className="lg:justify-self-end w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-[#0c1118]/85 backdrop-blur p-5 md:p-6 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-2">
                <span className="grid place-items-center h-7 w-7 rounded-lg bg-primary/20 text-primary ring-1 ring-primary/20">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="text-sm uppercase tracking-wider text-white/90">
                  {t.hero.panel.label}
                </span>
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                {[
                  { Icon: Car, ...t.hero.panel.vehicle },
                  { Icon: RouteIcon, ...t.hero.panel.style },
                  { Icon: MapPin, ...t.hero.panel.stops },
                  { Icon: Share2, ...t.hero.panel.share },
                ].map(({ Icon, k, v }) => (
                  <div key={k} className="grid grid-cols-[auto_92px_1fr] items-center gap-2.5">
                    <Icon className="h-4 w-4 text-primary" />
                    <dt className="text-white/60">{k}:</dt>
                    <dd className="text-white/90">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 h-24 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
                <svg viewBox="0 0 400 96" className="absolute inset-0 h-full w-full">
                  <path
                    d="M20 70 C 80 30, 140 80, 200 55 C 250 35, 310 65, 380 38"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                  />
                  {[[40, 60], [200, 55], [380, 38]].map(([x, y]) => (
                    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                      <circle r="5" fill="var(--primary)" opacity="0.25" />
                      <circle r="2.5" fill="var(--primary)" />
                    </g>
                  ))}
                </svg>
                <span className="absolute bottom-1.5 right-2 text-[10px] uppercase tracking-wider text-white/55">
                  {t.hero.panel.distance}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURE STRIP ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 -mt-12 md:-mt-16 relative z-10">
        <div className="rounded-2xl border border-border bg-surface/95 backdrop-blur shadow-2xl shadow-black/40 px-4 md:px-6 py-7 md:py-8 grid gap-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {t.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div key={f.title} className="text-center">
                <Icon className="mx-auto h-7 w-7 text-primary" />
                <h3 className="mt-3 font-display text-sm uppercase tracking-wide">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ HVA ER VEIGLEDE ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-24 md:py-28">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
            {t.what.eyebrow}
          </p>
          <span className="mx-auto mt-3 block h-0.5 w-12 bg-primary/70" />
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {t.what.cards.map((c, i) => {
            const Icon = WHAT_ICONS[i];
            const img = WHAT_IMAGES[i];
            return (
              <article
                key={c.title}
                className="group rounded-3xl border border-border bg-surface overflow-hidden flex flex-col hover:border-primary/40 hover:-translate-y-1 transition-all"
              >
                <div className="p-6 md:p-7">
                  <Icon className="h-7 w-7 text-primary" />
                  <h3 className="mt-4 font-display text-xl uppercase tracking-wide">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {c.body}
                  </p>
                </div>
                <div className="mt-auto px-5 pb-5">
                  <div className="overflow-hidden rounded-2xl aspect-[16/9]">
                    <img
                      src={img}
                      alt=""
                      aria-hidden
                      width={1024}
                      height={576}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ============ SLIK FUNGERER DET ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-24 md:pb-28">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-primary">
            {t.how.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-2xl md:text-4xl uppercase">
            {t.how.title}
          </h2>
          <span className="mx-auto mt-4 block h-0.5 w-12 bg-primary/70" />
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {t.how.steps.map((s, i) => (
            <li
              key={s.title}
              className="rounded-3xl border border-border bg-surface p-7 hover:border-primary/40 hover:-translate-y-1 transition-all"
            >
              <span className="font-display text-3xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-display text-lg uppercase tracking-wide">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {s.body}
              </p>
              {i === 0 && (
                <div className="mt-6 flex items-center gap-5 text-primary">
                  <Bike className="h-10 w-10" />
                  <Car className="h-10 w-10" />
                  <Caravan className="h-10 w-10" />
                </div>
              )}
              {i === 1 && (
                <div className="mt-6 h-12 relative">
                  <svg viewBox="0 0 320 48" className="absolute inset-0 h-full w-full">
                    <path
                      d="M10 36 C 70 6, 130 46, 190 22 S 290 12, 310 22"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2.5"
                      strokeDasharray="5 5"
                    />
                    {[[16, 38], [150, 30], [310, 22]].map(([x, y]) => (
                      <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                        <circle r="6" fill="var(--primary)" opacity="0.2" />
                        <circle r="3" fill="var(--primary)" />
                      </g>
                    ))}
                  </svg>
                </div>
              )}
              {i === 2 && (
                <div className="mt-6 flex items-center gap-4 text-primary">
                  <BookOpen className="h-10 w-10" />
                  <span className="h-px flex-1 border-t border-dashed border-primary/40" />
                  <Share2 className="h-8 w-8" />
                  <span className="h-px w-6 border-t border-dashed border-primary/40" />
                  <Users className="h-8 w-8" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ============ PLANLEGG SAMMEN ============ */}
      <section id="sammen" className="mx-auto max-w-7xl px-4 md:px-8 pb-24 md:pb-28">
        <div className="relative rounded-3xl border border-border bg-surface overflow-hidden">
          <img
            src={routeSognefjellet}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-surface/70" />
          <div className="relative p-7 md:p-10 grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-10 items-center">
            <div>
              <h3 className="font-display text-2xl md:text-3xl uppercase tracking-wide">
                {t.together.title}
              </h3>
              <p className="mt-3 text-muted-foreground leading-relaxed max-w-md">
                {t.together.body}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["#f59e0b", "#ef4444", "#3b82f6", "#10b981"].map((c) => (
                    <span
                      key={c}
                      className="h-9 w-9 rounded-full border-2 border-surface"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <span className="rounded-full bg-primary/15 text-primary px-2.5 py-1 text-xs font-semibold">
                  +12
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {t.together.mini.map((m, i) => {
                const Icon = [BookOpen, Users, Radio][i];
                return (
                  <div
                    key={m.title}
                    className="rounded-2xl border border-border bg-background/60 backdrop-blur p-4"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <h4 className="mt-3 font-display text-sm uppercase tracking-wide">
                      {m.title}
                    </h4>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {m.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============ POPULAR ROUTES ============ */}
      <section id="ruter" className="mx-auto max-w-7xl px-4 md:px-8 pb-24 md:pb-28">
        <div className="text-center">
          <h2 className="font-display text-2xl md:text-4xl uppercase">
            {t.routes.title}
          </h2>
          <span className="mx-auto mt-4 block h-0.5 w-12 bg-primary/70" />
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {POPULAR_ROUTES.map((r) => (
            <Link
              key={r.name}
              to="/trips/new"
              className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/40 hover:-translate-y-1 transition-all"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={r.img}
                  alt={r.name}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="p-4">
                <h3 className="font-display text-base uppercase tracking-wide">
                  {r.name}
                </h3>
                <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{t.routes.days(r.days)}</span>
                  <span>{r.km}</span>
                  <span className="inline-flex items-center gap-1 text-primary">
                    <RouteIcon className="h-3 w-3" /> {t.routes.styles[r.styleKey]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ BOTTOM CTA BAND ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-24 md:pb-28">
        <div className="relative rounded-2xl border border-border overflow-hidden">
          <img
            src={routeSognefjellet}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
          <div className="relative p-7 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="font-display text-2xl md:text-3xl uppercase tracking-wide">
                {t.cta.title1}
                <span className="text-primary">{t.cta.titleAccent}</span>
                {t.cta.title2}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {t.cta.body}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/trips/new"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 transition-all shadow-lg shadow-primary/25"
              >
                <Plus className="h-4 w-4" strokeWidth={3} /> {t.cta.primary}
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2/70 px-6 py-3.5 text-sm font-medium hover:bg-surface-2 transition-colors"
              >
                {t.cta.secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-10 flex flex-wrap items-center justify-between gap-6 text-xs text-muted-foreground">
          <VeigledeLogo size="sm" withTagline />
          <nav className="flex items-center gap-5">
            <Link to="/trips" className="hover:text-foreground">{t.footer.myTrips}</Link>
            <Link to="/trips/new" className="hover:text-foreground">{t.footer.newTrip}</Link>
            <Link to="/login" className="hover:text-foreground">{t.footer.login}</Link>
          </nav>
          <LanguageSwitcher />
          <span>© {new Date().getFullYear()} Veiglede</span>
        </div>
      </footer>
    </div>
  );
}

function CommunityCounter() {
  const fetcher = useServerFn(countPublicProfilesFn);
  const { data } = useQuery({
    queryKey: ["public-profiles-count"],
    queryFn: () => fetcher(),
    staleTime: 5 * 60_000,
  });
  if (!data || data < 1) return null;
  return (
    <p className="mt-4 inline-flex items-center gap-2 text-xs md:text-sm text-white/70">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      Bli med {data.toLocaleString("nb-NO")} andre som planlegger norske roadtrips
    </p>
  );
}
