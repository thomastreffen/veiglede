import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MapPin, Clock, Route as RouteIcon, Sparkles, Compass, BookOpen, Copy, Loader2, Flag, LogIn,
} from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { WillDriveButton } from "@/components/WillDriveButton";
import { TripReactionsRow } from "@/components/TripReactionsRow";
import { CuratedRoutePreview } from "@/components/CuratedRoutePreview";
import {
  COVERS, vehicleMeta, styleMeta, tripsApi,
  type CoverKey, type Trip, type Stop,
} from "@/lib/trips-store";
import { useAuth } from "@/lib/auth";
import { setReturnTo } from "@/lib/return-to";
import {
  CURATED_TRIPS, getCuratedTrip, COUNTRY_LABEL, curatedTripPoints, getCuratedGeometry,
  type CuratedTrip,
} from "@/lib/curated-trips";

export function curatedTripHead(slug: string) {
  const trip = getCuratedTrip(slug);
  if (!trip) return { meta: [{ title: "Inspirasjon — Veiglede" }] };
  const title = `${trip.title} — kuratert tur · Veiglede`;
  return {
    meta: [
      { title },
      { name: "description", content: trip.shortDescription },
      { property: "og:title", content: title },
      { property: "og:description", content: trip.shortDescription },
      { property: "og:image", content: trip.coverImage },
      { property: "og:type", content: "article" },
    ],
  };
}

interface Props { slug: string }

export function CuratedTripPage({ slug }: Props) {
  const trip = getCuratedTrip(slug);
  if (!trip) return <EmptyState />;
  return <CuratedTripView trip={trip} />;
}

function CuratedTripView({ trip }: { trip: CuratedTrip }) {
  const v = vehicleMeta(trip.vehicleSuitability[0] ?? "car");
  const s = styleMeta(trip.style);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copying, setCopying] = useState(false);
  const points = useMemo(() => curatedTripPoints(trip), [trip]);
  const geom = useMemo(() => getCuratedGeometry(trip.slug), [trip.slug]);

  const gotoLoginWithReturn = () => {
    if (typeof window !== "undefined") setReturnTo(window.location.pathname);
    navigate({ to: "/login" });
  };

  const copyToMyTrips = async (intent: "copy" | "customize" = "copy") => {
    if (!user) { gotoLoginWithReturn(); return; }
    if (copying) return;
    const existing = tripsApi.findCopyByOriginalId(trip.id);
    if (existing) {
      toast(intent === "customize" ? "Du har allerede en kopi — åpner den for redigering." : "Du har allerede kopiert denne — åpner kopien.");
      navigate({ to: "/trips/$tripId", params: { tripId: existing.id } });
      return;
    }
    setCopying(true);
    try {
      const sourceTrip: Partial<Trip> & { title: string } = {
        title: trip.title,
        subtitle: trip.subtitle,
        region: trip.region,
        origin: trip.origin,
        destination: trip.destination,
        distanceKm: trip.distanceKm,
        drivingTime: trip.drivingTime,
        cover: trip.cover,
        style: trip.style,
        vehicle: trip.vehicleSuitability[0] ?? "car",
        aiSummary: trip.whyDrive,
        // Real numeric fields so the copied trip doesn't show 0 km / 0 min.
        routeDistanceKm: geom?.distanceKm ?? trip.distanceKm,
        routeDurationMin: geom?.durationMin ?? trip.estimatedDurationMin,
        // Pre-computed road geometry so the planner shows the full route
        // immediately on "Tilpass ruten" — no rebuild required.
        routeGeometry: geom?.geometry,
        routeProvider: geom?.provider,
        originLoc: trip.originLoc,
        destinationLoc: trip.destinationLoc,
        isRoundTrip: trip.originLoc.lat === trip.destinationLoc.lat
          && trip.originLoc.lng === trip.destinationLoc.lng,
      };
      const sourceDays = trip.days.map((d, i) => ({
        id: `cur-day-${i}`,
        tripId: trip.id,
        dayNumber: i + 1,
        title: d.title,
        summary: d.summary,
      }));
      const sourceStops: Array<Partial<Stop> & { dayId: string }> = [];
      trip.days.forEach((d, i) => {
        const dayId = `cur-day-${i}`;
        d.stops.forEach((st, j) => {
          sourceStops.push({
            dayId,
            order: j,
            name: st.name,
            location: st.location,
            type: st.type,
            description: st.description,
            estimatedTime: st.estimatedTime,
            lat: st.lat,
            lng: st.lng,
          });
        });
      });
      const copy = tripsApi.copyPublicTrip({
        sourceTrip, sourceDays, sourceStops,
        originalTripId: trip.id,
        inspiredByDisplayName: "Veiglede",
      });
      toast.success(intent === "customize" ? "Kopiert og klar til å tilpasses." : "Turen er kopiert til Mine turer");
      navigate({ to: "/trips/$tripId", params: { tripId: copy.id } });
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke kopiere turen");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Veiglede"><VeigledeLogo size="md" /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> Kuratert av Veiglede
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-16">
        {/* Hero */}
        <section className={`mt-4 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${COVERS[trip.cover as CoverKey]} p-6 md:p-10 min-h-[260px]`}>
          <img src={trip.coverImage} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary">{COUNTRY_LABEL[trip.country]} · {trip.region}</p>
            <h1 className="mt-2 font-display text-4xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
            <p className="mt-3 text-base md:text-lg text-foreground/85 max-w-2xl">{trip.subtitle}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{s.emoji} {s.label}</Badge>
              {trip.vehicleSuitability.map((vt) => {
                const m = vehicleMeta(vt);
                return <Badge key={vt}>{m.emoji} {m.label}</Badge>;
              })}
              {trip.tags.map((tag) => <Badge key={tag} subtle>{tag}</Badge>)}
            </div>
          </div>
        </section>

        {/* Desktop split: main col + sticky sidebar. Mobile stacks naturally. */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Main column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Map preview */}
            <section>
              <div className="flex items-end justify-between mb-2">
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-primary">
                  <MapPin className="h-4 w-4" /> Ruteoversikt
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {geom ? `Faktisk veirute — ${geom.distanceKm} km · ${Math.round(geom.durationMin / 60 * 10) / 10} t` : "Skjematisk — faktisk vei beregnes når du kopierer turen."}
                </p>
              </div>
              <CuratedRoutePreview
                points={points}
                routeGeometry={geom?.geometry}
                interactive
                className="h-64 md:h-80 w-full rounded-2xl overflow-hidden border border-border"
              />
            </section>


            {/* Why drive */}
            <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
                <Sparkles className="h-4 w-4" /> Hvorfor kjøre denne?
              </p>
              <p className="mt-3 text-sm md:text-base leading-relaxed text-foreground/90">{trip.whyDrive}</p>
            </section>

            {/* Roadbook */}
            <section id="roadbook">
              <h2 className="font-display text-2xl md:text-3xl uppercase">Roadbook — dag for dag</h2>
              <ol className="mt-4 space-y-3">
                {trip.days.map((day, i) => (
                  <li key={i} className="rounded-2xl border border-border bg-surface p-4 md:p-5">
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-2xl uppercase text-primary">Dag {i + 1}</span>
                    </div>
                    <p className="font-display text-lg md:text-xl uppercase">{day.title}</p>
                    {day.summary && <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{day.summary}</p>}
                    <ul className="mt-3 space-y-2">
                      {day.stops.map((stop, j) => (
                        <li key={j} className="rounded-xl border border-border/60 bg-background/40 p-3">
                          <div className="flex items-start gap-2.5 text-sm">
                            <span className="h-7 w-7 rounded-lg bg-surface-2 grid place-items-center shrink-0 text-base">
                              {stopEmoji(stop.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{stop.name}</p>
                              {stop.location && <p className="text-[11px] text-muted-foreground">{stop.location}</p>}
                              {stop.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{stop.description}</p>}
                            </div>
                            {stop.estimatedTime && <span className="text-[11px] text-muted-foreground shrink-0">{stop.estimatedTime}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Stat Icon={RouteIcon} label="Distanse" value={`${trip.distanceKm} km`} />
              <Stat Icon={Clock} label="Kjøretid" value={trip.drivingTime} />
              <Stat Icon={MapPin} label="Stopp" value={String(trip.stopsCount)} />
              <Stat Icon={Flag} label="Best for" value={v.label} />
            </div>

            {/* CTA bar */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <WillDriveButton tripId={trip.id} />
              <button
                type="button"
                onClick={() => copyToMyTrips("copy")}
                disabled={copying}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : !user ? <LogIn className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {!user ? "Logg inn for å kopiere" : "Kopier til mine turer"}
              </button>
              <button
                type="button"
                onClick={() => copyToMyTrips("customize")}
                disabled={copying}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
                Tilpass ruten
              </button>
              <a
                href="#roadbook"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2.5 text-xs font-semibold hover:border-primary hover:text-primary"
              >
                <BookOpen className="h-4 w-4" /> Hopp til roadbook
              </a>
              <TripReactionsRow tripId={trip.id} size="sm" hideDrive />
            </div>
          </aside>
        </div>

        {/* Related curated */}
        <section className="mt-10">
          <h2 className="font-display text-2xl uppercase">Andre kuraterte turer</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CURATED_TRIPS.filter((c) => c.slug !== trip.slug).slice(0, 4).map((c) => (
              <Link
                key={c.slug}
                to="/inspirasjon/$slug"
                params={{ slug: c.slug }}
                className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/60 transition-colors"
              >
                <div className="relative h-32">
                  <img src={c.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                    <Sparkles className="h-2.5 w-2.5" /> Kuratert
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary">{c.region}</p>
                  <h3 className="mt-0.5 font-display text-base uppercase group-hover:text-primary">{c.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.shortDescription}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  const cls = subtle
    ? "border-border bg-background/40 text-muted-foreground"
    : "border-border bg-background/60 text-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur border px-3 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function Stat({ Icon, label, value }: { Icon: typeof RouteIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-xl uppercase truncate">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function stopEmoji(t: CuratedTrip["days"][number]["stops"][number]["type"]): string {
  switch (t) {
    case "viewpoint": return "🌄";
    case "photo": return "📸";
    case "food": return "🍽️";
    case "lodging": return "🛏️";
    case "fuel": return "⛽";
    case "attraction": return "🎯";
    case "city": return "🏙️";
    case "experience": return "✨";
    case "detour": return "↪️";
    case "ferry": return "⛴️";
    default: return "📍";
  }
}

function EmptyState() {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <Compass className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="mt-3 font-display text-2xl uppercase">Fant ikke denne turen</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">Lenken kan være utløpt eller feil.</p>
        <Link to="/explore" className="mt-5 inline-flex text-sm text-primary underline">Utforsk andre turer</Link>
      </div>
    </div>
  );
}
