import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
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
  Instagram,
  Facebook,
  Snowflake,
  Sun,
  Leaf,
  Flower2,
} from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n/provider";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { countPublicProfilesFn } from "@/lib/public-profiles.functions";
import { fetchPublicTrips } from "@/lib/public-trips";
import heroFjord from "@/assets/hero-fjord.jpg";
import routeLofoten from "@/assets/route-lofoten.jpg";
import routeAtlanterhavsveien from "@/assets/route-atlanterhavsveien.jpg";
import routeHardanger from "@/assets/route-hardanger.jpg";
import routeSognefjellet from "@/assets/route-sognefjellet.jpg";
import routeTrollstigen from "@/assets/route-trollstigen.jpg";
import groupMotorcycles from "@/assets/group-motorcycles.jpg";

export const Route = createFileRoute("/")({
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

const HERO_IMAGES = [
  heroFjord,
  routeLofoten,
  routeAtlanterhavsveien,
  routeHardanger,
  routeSognefjellet,
  routeTrollstigen,
];

const POPULAR_ROUTES = [
  { img: routeLofoten, name: "Lofoten rundt", days: 5, km: "~ 850 km", styleKey: "svingete" as const },
  { img: routeAtlanterhavsveien, name: "Atlanterhavsveien", days: 1, km: "~ 160 km", styleKey: "fototur" as const },
  { img: routeHardanger, name: "Hardanger rundt", days: 3, km: "~ 600 km", styleKey: "cruise" as const },
  { img: routeSognefjellet, name: "Sognefjellet", days: 1, km: "~ 235 km", styleKey: "svingete" as const },
];

const REGIONS = [
  { name: "Vestlandet", tag: "Fjorder, fjell og nasjonale turistveier", km: "300–900 km turer", img: routeHardanger, color: "#1e3a5f" },
  { name: "Nord-Norge", tag: "Midnattssol, Lofoten og Nordkapp", km: "500–1500 km turer", img: routeLofoten, color: "#0c2340" },
  { name: "Fjell-Norge", tag: "Jotunheimen, Rondane og høyfjellet", km: "200–600 km turer", img: routeSognefjellet, color: "#2d5a3d" },
  { name: "Østlandet", tag: "Skog, innsjøer og kulturlandskap", km: "150–500 km turer", img: groupMotorcycles, color: "#4a5568" },
  { name: "Trøndelag", tag: "Kyst, fjell og historiske veier", km: "300–700 km turer", img: routeTrollstigen, color: "#6b3a2a" },
  { name: "Sørlandet", tag: "Hvite hus, skjærgård og solfylte kyststier", km: "200–600 km turer", img: routeAtlanterhavsveien, color: "#c9a84c" },
];

const SCENIC_ROUTES = [
  { name: "Atlanterhavsveien", km: "8 km", img: routeAtlanterhavsveien },
  { name: "Trollstigen", km: "106 km", img: routeTrollstigen },
  { name: "Sognefjellet", km: "108 km", img: routeSognefjellet },
];

const FEATURE_ICONS = [Mountain, MapPin, Sparkles, BookOpen, Users];
const WHAT_ICONS = [User, Users, Camera];
const WHAT_IMAGES = [heroFjord, groupMotorcycles, routeHardanger];

function getSeason(month: number) {
  if (month >= 5 && month <= 7) {
    return {
      Icon: Sun,
      title: "Midnattssol og fjordveier",
      body: "Lyse netter, åpne fjellpass og endeløse kystveier. Nord-Norge venter.",
      cta: "Utforsk Nord-Norge",
      region: "Nord-Norge",
      img: routeLofoten,
    };
  }
  if (month >= 8 && month <= 9) {
    return {
      Icon: Leaf,
      title: "Høstfarger i fjellet",
      body: "Jotunheimen og Hardanger gløder i oktober. Kjør sakte, stopp ofte.",
      cta: "Utforsk høstruter",
      region: "Fjell-Norge",
      img: routeHardanger,
    };
  }
  if (month >= 10 || month <= 1) {
    return {
      Icon: Snowflake,
      title: "Vinterveier og snødekte pass",
      body: "Stille fjorder, hvite vidder og rolige veier. Vinteren har sin egen rytme.",
      cta: "Utforsk vinterruter",
      region: "Vestlandet",
      img: routeSognefjellet,
    };
  }
  return {
    Icon: Flower2,
    title: "Vårens første turer",
    body: "Kysten våkner først. Salt luft, blomstrende veikanter og lange ettermiddager.",
    cta: "Utforsk kystruter",
    region: "Sørlandet",
    img: routeAtlanterhavsveien,
  };
}

function Landing() {
  const { user } = useAuth();
  const t = useT();
  const [heroIndex, setHeroIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  if (typeof document !== "undefined") {
    if (document.title !== t.meta.title) document.title = t.meta.title;
  }

  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const season = useMemo(() => getSeason(new Date().getMonth()), []);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a]">
      {/* ============ STICKY NAV ============ */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#FAFAF8]/95 backdrop-blur border-b border-black/5 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Veiglede" className={scrolled ? "text-[#1a1a1a]" : "text-white"}>
            <VeigledeLogo size="md" tone={scrolled ? "dark" : "light"} />
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher
              tone={scrolled ? "dark" : "light"}
              className="hidden sm:inline-flex"
            />
            {user ? (
              <Link
                to="/trips"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                {t.nav.myTrips} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`text-sm px-3 py-2 transition-colors ${
                    scrolled ? "text-[#1a1a1a]/80 hover:text-[#1a1a1a]" : "text-white/85 hover:text-white"
                  }`}
                >
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
      </header>

      {/* ============ HERO (rotating slideshow) ============ */}
      <section className="relative isolate overflow-hidden min-h-[100svh] flex flex-col">
        {HERO_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden={i !== heroIndex}
            width={1920}
            height={1200}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ease-in-out"
            style={{ opacity: i === heroIndex ? 1 : 0 }}
          />
        ))}
        {/* Lighter overlay that fades into the page background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#FAFAF8]" />
        {/* Local readability gradient behind text (left side) */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 md:px-8 pt-32 md:pt-40 pb-32 md:pb-40 flex-1 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center text-white">
          <div style={{ textShadow: "0 2px 24px rgba(0,0,0,0.4)" }}>
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
            <p className="mt-7 max-w-xl text-base md:text-lg text-white/90 leading-relaxed">
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 backdrop-blur px-6 py-4 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                {t.hero.ctaSecondary} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs md:text-sm text-white/85 max-w-md leading-relaxed">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary shrink-0" />
              {t.hero.note}
            </p>
          </div>

          {/* Right: "Din neste tur" panel */}
          <div className="lg:justify-self-end w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-[#0c1118]/80 backdrop-blur p-5 md:p-6 shadow-2xl shadow-black/50">
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

        {/* Slideshow indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Bilde ${i + 1}`}
              onClick={() => setHeroIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === heroIndex ? "w-8 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </section>

      {/* ============ SOCIAL PROOF STRIP (dark band) ============ */}
      <SocialProofStrip />

      {/* ============ FEATURE STRIP ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 -mt-12 md:-mt-16 relative z-10">
        <div className="rounded-2xl border border-black/5 bg-white shadow-xl shadow-black/10 px-4 md:px-6 py-7 md:py-8 grid gap-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {t.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div key={f.title} className="text-center">
                <Icon className="mx-auto h-7 w-7 text-primary" />
                <h3 className="mt-3 font-display text-sm uppercase tracking-wide text-[#1a1a1a]">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-xs text-[#1a1a1a]/60 leading-relaxed whitespace-pre-line">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ NORGE PÅ VEIEN ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-24 md:py-28">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-primary">Regioner</p>
          <h2 className="mt-3 font-display text-3xl md:text-5xl uppercase">Norge på veien</h2>
          <p className="mt-4 text-[#1a1a1a]/70 max-w-xl mx-auto">
            Fra Lindesnes til Nordkapp — opplev landet fra rattet.
          </p>
          <span className="mx-auto mt-5 block h-0.5 w-12 bg-primary/70" />
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REGIONS.map((r) => (
            <Link
              key={r.name}
              to="/explore"
              
              className="group relative isolate overflow-hidden rounded-2xl aspect-[4/5] flex flex-col justify-end p-6 text-white shadow-lg hover:-translate-y-1 transition-all"
              style={{ background: r.color }}
            >
              <img
                src={r.img}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative">
                <h3 className="font-display text-2xl md:text-3xl uppercase tracking-wide">
                  {r.name}
                </h3>
                <p className="mt-2 text-sm text-white/90 leading-snug">{r.tag}</p>
                <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-wider">
                  <span className="text-white/75">{r.km}</span>
                  <span className="inline-flex items-center gap-1 text-primary font-semibold">
                    Utforsk ruter <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ NASJONALE TURISTVEIER ============ */}
      <section className="bg-white border-y border-black/5">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-24 md:py-28">
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-12 items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-primary">
                Nasjonale turistveier
              </p>
              <h2 className="mt-3 font-display text-3xl md:text-5xl uppercase leading-[0.95]">
                18 strekninger.
                <br />
                <span className="text-primary">Alle dekket.</span>
              </h2>
              <p className="mt-5 text-[#1a1a1a]/70 leading-relaxed max-w-md">
                Norge har 18 offisielle nasjonale turistveier — utvalgte strekninger med
                arkitektur, utsikt og stopp i verdensklasse. Veiglede dekker alle 18.
              </p>
              <Link
                to="/trips/new"
                className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#1a1a1a] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#1a1a1a]/90 transition-all"
              >
                Planlegg din turistveirute <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {SCENIC_ROUTES.map((s) => (
                <div
                  key={s.name}
                  className="group relative overflow-hidden rounded-2xl aspect-[3/4] shadow-lg"
                >
                  <img
                    src={s.img}
                    alt={s.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary">
                      Turistvei
                    </p>
                    <h3 className="mt-1 font-display text-lg uppercase tracking-wide">
                      {s.name}
                    </h3>
                    <p className="text-xs text-white/80">{s.km}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ HVA ER VEIGLEDE ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-24 md:py-28">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#1a1a1a]/50">
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
                className="group rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div className="p-6 md:p-7">
                  <Icon className="h-7 w-7 text-primary" />
                  <h3 className="mt-4 font-display text-xl uppercase tracking-wide">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#1a1a1a]/65 leading-relaxed">{c.body}</p>
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

      {/* ============ SEASONAL ============ */}
      <section className="bg-[#F0EDE8] border-y border-black/5">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-24 md:py-28 grid lg:grid-cols-2 gap-10 items-center">
          <div className="relative aspect-[5/4] rounded-3xl overflow-hidden shadow-xl">
            <img
              src={season.img}
              alt={season.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent" />
          </div>
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary">
              <season.Icon className="h-4 w-4" /> Nå er det tid for...
            </p>
            <h2 className="mt-4 font-display text-3xl md:text-5xl uppercase leading-[0.95]">
              {season.title}
            </h2>
            <p className="mt-5 text-[#1a1a1a]/70 leading-relaxed text-lg max-w-md">
              {season.body}
            </p>
            <Link
              to="/explore"
              search={{ region: season.region } as never}
              className="mt-7 inline-flex items-center gap-2 rounded-2xl border-2 border-[#1a1a1a] px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white transition-all"
            >
              {season.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ SLIK FUNGERER DET ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 py-24 md:py-28">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.32em] text-primary">{t.how.eyebrow}</p>
          <h2 className="mt-3 font-display text-2xl md:text-4xl uppercase">{t.how.title}</h2>
          <span className="mx-auto mt-4 block h-0.5 w-12 bg-primary/70" />
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {t.how.steps.map((s, i) => (
            <li
              key={s.title}
              className="rounded-3xl border border-black/5 bg-white shadow-sm p-7 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <span className="font-display text-3xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 font-display text-lg uppercase tracking-wide">{s.title}</h3>
              <p className="mt-2 text-sm text-[#1a1a1a]/65 leading-relaxed">{s.body}</p>
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

      {/* ============ POPULAR ROUTES ============ */}
      <section id="ruter" className="mx-auto max-w-7xl px-4 md:px-8 pb-24 md:pb-28">
        <div className="text-center">
          <h2 className="font-display text-2xl md:text-4xl uppercase">{t.routes.title}</h2>
          <span className="mx-auto mt-4 block h-0.5 w-12 bg-primary/70" />
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {POPULAR_ROUTES.map((r) => (
            <Link
              key={r.name}
              to="/trips/new"
              className="group rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
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
                <h3 className="font-display text-base uppercase tracking-wide">{r.name}</h3>
                <div className="mt-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#1a1a1a]/55">
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

      {/* ============ BOTTOM CTA ============ */}
      <section className="mx-auto max-w-7xl px-4 md:px-8 pb-24 md:pb-28">
        <div className="relative rounded-3xl overflow-hidden">
          <img
            src={routeSognefjellet}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#1a1a1a]/85 to-[#1a1a1a]/30" />
          <div className="relative p-8 md:p-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-white">
            <div className="max-w-xl">
              <h3 className="font-display text-2xl md:text-4xl uppercase tracking-wide">
                {t.cta.title1}
                <span className="text-primary">{t.cta.titleAccent}</span>
                {t.cta.title2}
              </h3>
              <p className="mt-3 text-sm text-white/80 leading-relaxed">{t.cta.body}</p>
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 backdrop-blur px-6 py-3.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                {t.cta.secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#1a1a1a] text-white/80">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-14 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="text-white">
              <VeigledeLogo size="md" tone="light" />
            </div>
            <p className="mt-4 text-sm text-white/60 max-w-xs leading-relaxed">
              Finn veien som betyr noe. AI-drevet roadtrip-planlegger laget for norske veier.
            </p>
            <p className="mt-5 text-xs text-white/70">Stolt norsk produkt 🇳🇴</p>
          </div>
          <div>
            <h4 className="font-display text-xs uppercase tracking-[0.2em] text-white">
              Veiglede
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">Om oss</a></li>
              <li><a href="#" className="hover:text-white">Personvern</a></li>
              <li><a href="#" className="hover:text-white">Kontakt</a></li>
              <li><a href="#" className="hover:text-white">For partnere</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-xs uppercase tracking-[0.2em] text-white">App</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/trips/new" className="hover:text-white">{t.footer.newTrip}</Link></li>
              <li><Link to="/trips" className="hover:text-white">{t.footer.myTrips}</Link></li>
              <li><Link to="/explore" className="hover:text-white">Utforsk</Link></li>
              <li><Link to="/login" className="hover:text-white">{t.footer.login}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-xs uppercase tracking-[0.2em] text-white">Følg</h4>
            <div className="mt-4 flex gap-3">
              <a
                href="#"
                aria-label="Instagram"
                className="grid place-items-center h-9 w-9 rounded-full border border-white/20 hover:bg-white/10"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="grid place-items-center h-9 w-9 rounded-full border border-white/20 hover:bg-white/10"
              >
                <Facebook className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-5">
              <LanguageSwitcher tone="light" />
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 md:px-8 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-white/50">
            <span>© {new Date().getFullYear()} Veiglede</span>
            <span>Laget for norske veier</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SocialProofStrip() {
  const counter = useServerFn(countPublicProfilesFn);
  const tripsFetcher = useServerFn(fetchPublicTrips);
  const { data: count } = useQuery({
    queryKey: ["public-profiles-count"],
    queryFn: () => counter(),
    staleTime: 5 * 60_000,
  });
  const { data: trips } = useQuery({
    queryKey: ["public-trips-landing"],
    queryFn: () => tripsFetcher(),
    staleTime: 5 * 60_000,
  });

  const recent = (trips ?? []).slice(0, 6);

  return (
    <section className="bg-[#0c1118] text-white relative z-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-10 md:py-12">
        <div className="flex items-center gap-3 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <p className="text-white/85">
            {count && count > 0 ? (
              <>
                Bli med <span className="font-semibold text-white">{count.toLocaleString("nb-NO")}</span> andre som planlegger norske roadtrips
              </>
            ) : (
              <>Bli med flere som planlegger norske roadtrips</>
            )}
          </p>
        </div>
        {recent.length > 0 && (
          <div className="mt-6 -mx-4 md:mx-0 overflow-x-auto md:overflow-visible">
            <div className="flex md:grid md:grid-cols-3 gap-3 px-4 md:px-0 snap-x snap-mandatory">
              {recent.slice(0, 3).map((t) => (
                <Link
                  key={t.id}
                  to="/shared/$shareToken"
                  params={{ shareToken: t.shareToken }}
                  className="group snap-start shrink-0 w-[80%] md:w-auto rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur p-4 transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/50">
                    <span>{t.region || "Norge"}</span>
                    <span>{Math.round(t.distanceKm)} km</span>
                  </div>
                  <h3 className="mt-2 font-display text-base uppercase tracking-wide line-clamp-1">
                    {t.title}
                  </h3>
                  <p className="mt-1 text-xs text-white/65 line-clamp-1">
                    {t.origin} → {t.destination}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-white/55">{t.ownerName || "Anonym"}</span>
                    <span className="text-primary inline-flex items-center gap-1">
                      Se tur <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
