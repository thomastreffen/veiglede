import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTripsStore, tripsApi, COVERS, VEHICLES, ROUTE_STYLES, vehicleMeta, styleMeta, FEATURED_ROUTES, type CoverKey, type VehicleType, type RouteStyle } from "@/lib/trips-store";
import { useTripTracking, statusMeta } from "@/lib/trip-tracking";
import { useAuth } from "@/lib/auth";
import { listFollowedTrips, type FollowedTrip } from "@/lib/trip-invites";
import { useVehicles } from "@/lib/vehicles-store";
import { feedFromFollowsFn, type FeedTrip } from "@/lib/social.functions";
import { Plus, MapPin, Clock, Route as RouteIcon, Camera, ArrowRight, Trash2, Users, Radio, Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { useLiveSession, isLiveActive } from "@/lib/live-tracking";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/trips")({
  head: () => ({ meta: [{ title: "Mine turer — Veiglede" }] }),
  component: TripsDashboard,
});

function TripsDashboard() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { trips: allTrips, stops } = useTripsStore();
  const { vehicles } = useVehicles();
  // Drafts only appear in "Mine turer" after the user explicitly saves them.
  const trips = allTrips.filter((t) => t.status !== "draft");
  const photoStops = stops.filter((s) => s.photoOp === true).length;

  if (pathname !== "/trips") {
    return <Outlet />;
  }

  return (
    <div className="py-5 md:py-8">
      {/* Stats strip */}
      <section className="grid grid-cols-4 md:grid-cols-5 gap-3 md:gap-6 rounded-2xl border border-border bg-surface/70 p-4 md:p-6">
        {(() => {
          const planned = trips.reduce((a, t) => a + (t.distanceKm ?? 0), 0);
          const driven = trips.reduce(
            (a, t) => a + (typeof t.actualDistanceKm === "number" && t.actualDistanceKm > 0 ? t.actualDistanceKm : 0),
            0,
          );
          return (
            <>
              <StatCell n={String(trips.length)} l="planlagte turer" />
              <div className="md:hidden">
                <p className="font-display text-lg md:text-xl leading-tight">
                  {planned.toLocaleString("nb-NO")}<span className="text-[9px] uppercase tracking-wider text-muted-foreground ml-1">planlagt</span>
                </p>
                <p className="font-display text-lg md:text-xl leading-tight mt-0.5">
                  {Math.round(driven).toLocaleString("nb-NO")}<span className="text-[9px] uppercase tracking-wider text-primary ml-1">kjørt</span>
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">km</p>
              </div>
              <StatCell className="hidden md:block" n={planned.toLocaleString("nb-NO")} l="km planlagt" />
              <StatCell className="hidden md:block" n={Math.round(driven).toLocaleString("nb-NO")} l="km kjørt" accent />
              <StatCell n={String(vehicles.length)} l="kjøretøy" />
              <StatCell n={String(photoStops)} l="fotostopp" />
            </>
          );
        })()}
      </section>


      {/* Search & filters */}
      <div className="mt-6 space-y-3">
        <SearchAndFilters allTrips={trips} />
      </div>

      {/* Featured routes */}

      <FollowedTripsSection />
      <FeedFromFollowsSection />

      {/* Featured routes */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide">Foreslåtte ruter</h2>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Norge</span>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {FEATURED_ROUTES.map((r) => (
            <li key={r.id}>
              <Link to="/trips/new" className={`block rounded-2xl border border-border bg-gradient-to-br ${COVERS[r.cover]} p-5 relative overflow-hidden hover:border-primary/60 transition-colors`}>
                <div className="absolute inset-0 bg-background/30" />
                <div className="relative">
                  <span className="text-2xl">{r.emoji}</span>
                  <p className="mt-3 text-[11px] uppercase tracking-wider text-foreground/80">{r.region}</p>
                  <h3 className="mt-1 font-display text-xl uppercase">{r.title}</h3>
                  <p className="mt-2 text-xs text-foreground/80">{r.km} km · {styleMeta(r.style).label}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">Planlegg <ArrowRight className="h-3 w-3" /></p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TripCard({ t }: { t: ReturnType<typeof useTripsStore>["trips"][number] }) {
  const v = vehicleMeta(t.vehicle);
  const s = styleMeta(t.style);
  const tracking = useTripTracking(t.id);
  const tm = statusMeta(tracking.status);
  const [confirming, setConfirming] = useState(false);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <li>
      <Link to="/trips/$tripId" params={{ tripId: t.id }} className="group relative block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 transition-colors">
        <div className={`relative h-36 bg-gradient-to-br ${COVERS[t.cover as CoverKey]}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 200 80" preserveAspectRatio="none">
            <path d="M0,60 C40,45 60,15 100,30 C140,45 160,10 200,20" fill="none" stroke="oklch(0.78 0.17 65 / 0.55)" strokeWidth="1.5" />
          </svg>
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider border border-border">
            <span>{s.emoji}</span> {s.label}
          </span>
          <span className="absolute top-3 right-3 text-xl">{v.emoji}</span>
          {tracking.status !== "idle" && (
            <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full backdrop-blur px-2.5 py-1 text-[10px] font-semibold border ${tm.cls}`}>
              {tm.emoji} {tm.label}
            </span>
          )}
        </div>
        <div className="p-4 md:p-5">
          <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}{t.vehicleName ? ` · ${t.vehicleName}` : ""}</p>
          <h3 className="mt-1 font-display text-xl md:text-2xl uppercase leading-tight group-hover:text-primary transition-colors">{t.title}</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} v={`${t.distanceKm} km`} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} v={t.drivingTime} />
            <Stat icon={<Camera className="h-3.5 w-3.5" />} v={`${t.stopsCount} stopp`} />
          </div>
          {typeof t.actualDistanceKm === "number" && t.actualDistanceKm > 0 && (
            <p className="mt-2 text-[11px] text-primary">
              {Math.round(t.actualDistanceKm)} km kjørt · {t.distanceKm} km planlagt
            </p>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.origin} → {t.destination}</span>
            {t.startDate && <span>{formatDate(t.startDate)}</span>}
          </div>
        </div>

        {!confirming && (
          <button
            type="button"
            aria-label="Slett tur"
            onClick={(e) => { stop(e); setConfirming(true); }}
            className="absolute top-3 right-12 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:border-destructive transition-opacity"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        {confirming && (
          <div
            onClick={stop}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm p-4 text-center"
          >
            <p className="font-display text-lg uppercase">Slett denne turen?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => { stop(e); tripsApi.deleteTrip(t.id); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-bold uppercase tracking-wider text-destructive-foreground hover:brightness-110"
              >
                <Trash2 className="h-3.5 w-3.5" /> Slett
              </button>
              <button
                type="button"
                onClick={(e) => { stop(e); setConfirming(false); }}
                className="inline-flex items-center rounded-xl border border-border bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:border-primary"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </Link>
    </li>
  );
}

function Stat({ icon, v }: { icon: React.ReactNode; v: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-foreground/90">
      <span className="text-primary">{icon}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "short" }); } catch { return d; }
}

function FollowedTripsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState<FollowedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    listFollowedTrips()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading || items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide">Turer jeg følger</h2>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{items.length} {items.length === 1 ? "tur" : "turer"}</span>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => <FollowedTripCard key={`${String((f.trip as Record<string, unknown>).id ?? "")}-${i}`} f={f} />)}
      </ul>
    </section>
  );
}

function FollowedTripCard({ f }: { f: FollowedTrip }) {
  const t = f.trip as Record<string, unknown>;
  const id = String(t.id ?? "");
  const cover = (t.cover as CoverKey) ?? "fjord";
  const title = String(t.title ?? "Tur");
  const origin = String(t.origin ?? "");
  const destination = String(t.destination ?? "");
  const region = String(t.region ?? "");
  const km = Number(t.distanceKm ?? 0);
  const drivingTime = String(t.drivingTime ?? "");
  const stopsCount = Number(t.stopsCount ?? 0);
  const session = useLiveSession(id);
  const live = isLiveActive(session);
  return (
    <li>
      <div className="group relative block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 transition-colors">
        <Link to="/trips/$tripId" params={{ tripId: id }}>
          <div className={`relative h-28 bg-gradient-to-br ${COVERS[cover]}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider border border-border">
              <Users className="h-3 w-3 text-primary" /> Reisefølge
            </span>
            {live && (
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-primary/90 text-primary-foreground px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" /> Live
              </span>
            )}
            <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider border border-border">
              {f.role === "editor" ? "Kan redigere" : "Kan se"}
            </span>
          </div>
          <div className="p-4 md:p-5">
            {region && <p className="text-[10px] uppercase tracking-wider text-primary">{region}</p>}
            <h3 className="mt-1 font-display text-xl uppercase leading-tight group-hover:text-primary transition-colors">{title}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} v={`${km} km`} />
              <Stat icon={<Clock className="h-3.5 w-3.5" />} v={drivingTime} />
              <Stat icon={<Camera className="h-3.5 w-3.5" />} v={`${stopsCount} stopp`} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
              <span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {origin} → {destination}</span>
              {f.owner_name && <span className="truncate">av {f.owner_name}</span>}
            </div>
          </div>
        </Link>
        {live && session?.live_share_token && (
          <Link
            to="/live/$token"
            params={{ token: session.live_share_token }}
            className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
          >
            <Radio className="h-3 w-3 animate-pulse" /> Følg live
          </Link>
        )}
      </div>
    </li>
  );
}

function FeedFromFollowsSection() {
  const { user } = useAuth();
  const fetcher = useServerFn(feedFromFollowsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["feed-from-follows", user?.id],
    queryFn: () => fetcher(),
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!user || isLoading || !data || data.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl md:text-2xl uppercase tracking-wide">Fra folk du følger</h2>
        <Link to="/explore" className="text-xs text-primary hover:underline">Se alle på Utforsk →</Link>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.slice(0, 6).map((t) => (
          <li key={t.id}>
            <FeedTripCard t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeedTripCard({ t }: { t: FeedTrip }) {
  const v = vehicleMeta(t.vehicle as VehicleType);
  const s = styleMeta(t.style as RouteStyle);
  const cover = (t.cover as CoverKey) ?? "fjord";
  return (
    <Link to="/shared/$shareToken" params={{ shareToken: t.shareToken }} className="group relative block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 transition-colors">
      <div className={`relative h-28 bg-gradient-to-br ${COVERS[cover]}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider border border-border">
          {s.emoji} {s.label}
        </span>
        <span className="absolute top-3 right-3 text-xl">{v.emoji}</span>
      </div>
      <div className="p-4 md:p-5">
        {t.region && <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}</p>}
        <h3 className="mt-1 font-display text-xl uppercase leading-tight group-hover:text-primary transition-colors">{t.title}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} v={`${t.distanceKm} km`} />
          <Stat icon={<Clock className="h-3.5 w-3.5" />} v={t.drivingTime} />
          <Stat icon={<Camera className="h-3.5 w-3.5" />} v={`${t.stopsCount} stopp`} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
          <span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {t.origin} → {t.destination}</span>
          {t.ownerName && <span className="truncate">av {t.ownerName}</span>}
        </div>
      </div>
    </Link>
  );
}


function EmptyState() {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <p className="font-display text-2xl uppercase">Ingen turer enda</p>
      <p className="mt-2 text-sm text-muted-foreground">Planlegg din første tur på under et minutt.</p>
      <Link to="/trips/new" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">
        Start ny tur <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

type SortOption = "newest" | "oldest" | "longest" | "shortest";

function SearchAndFilters({ allTrips }: { allTrips: ReturnType<typeof useTripsStore>["trips"] }) {
  const [query, setQuery] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<"all" | VehicleType>("all");
  const [styleFilter, setStyleFilter] = useState<"all" | RouteStyle>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const q = query.trim().toLowerCase();
  const activeCount = (q ? 1 : 0) + (vehicleFilter !== "all" ? 1 : 0) + (styleFilter !== "all" ? 1 : 0);

  const filtered = useMemo(() => {
    let result = allTrips.filter((t) => {
      if (q) {
        const haystack = `${t.title} ${t.subtitle ?? ""} ${t.origin} ${t.destination} ${t.region ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (vehicleFilter !== "all" && t.vehicle !== vehicleFilter) return false;
      if (styleFilter !== "all" && t.style !== styleFilter) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest": return b.createdAt - a.createdAt;
        case "oldest": return a.createdAt - b.createdAt;
        case "longest": return b.distanceKm - a.distanceKm;
        case "shortest": return a.distanceKm - b.distanceKm;
        default: return 0;
      }
    });

    return result;
  }, [allTrips, q, vehicleFilter, styleFilter, sortBy]);

  return (
    <>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk i turer…"
          className="pl-9 pr-9 rounded-xl"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Tøm søk"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={vehicleFilter} onValueChange={(v) => setVehicleFilter(v as "all" | VehicleType)}>
          <SelectTrigger className="w-[150px] rounded-xl text-xs">
            <SelectValue placeholder="Kjøretøy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kjøretøy</SelectItem>
            {VEHICLES.map((v) => (
              <SelectItem key={v.value} value={v.value}>{v.emoji} {v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={styleFilter} onValueChange={(v) => setStyleFilter(v as "all" | RouteStyle)}>
          <SelectTrigger className="w-[170px] rounded-xl text-xs">
            <SelectValue placeholder="Stil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle stiler</SelectItem>
            {ROUTE_STYLES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px] rounded-xl text-xs">
            <SelectValue placeholder="Sorter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Nyeste først</SelectItem>
            <SelectItem value="oldest">Eldste først</SelectItem>
            <SelectItem value="longest">Lengste tur</SelectItem>
            <SelectItem value="shortest">Kortest tur</SelectItem>
          </SelectContent>
        </Select>

        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
            {activeCount} {activeCount === 1 ? "aktivt filter" : "aktive filter"}
            <button
              type="button"
              onClick={() => { setQuery(""); setVehicleFilter("all"); setStyleFilter("all"); setSortBy("newest"); }}
              className="ml-0.5 hover:text-destructive"
              aria-label="Nullstill filter"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>

      {/* Header + CTA */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Mine turer</p>
          <h1 className="mt-1 font-display text-3xl md:text-5xl uppercase">{filtered.length} turer</h1>
        </div>
        <Link to="/trips/new" className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" strokeWidth={3} /> Ny tur
        </Link>
      </div>

      {allTrips.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
          <p className="font-display text-2xl uppercase">Ingen turer matcher søket</p>
          <p className="mt-2 text-sm text-muted-foreground">Prøv å justere filtere eller søkeord.</p>
          <button
            type="button"
            onClick={() => { setQuery(""); setVehicleFilter("all"); setStyleFilter("all"); setSortBy("newest"); }}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
          >
            Nullstill filter
          </button>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => <TripCard key={t.id} t={t} />)}
        </ul>
      )}
    </>
  );
}
