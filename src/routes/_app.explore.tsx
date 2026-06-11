import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { fetchPublicTrips, type PublicTripSummary } from "@/lib/public-trips";
import { fetchPublicProfilesFn } from "@/lib/public-profiles.functions";
import { getTripSocialStatsFn, type TripSocialStats } from "@/lib/social.functions";
import { PublicUserCard } from "@/components/PublicUserCard";
import { PublicTripCard } from "@/components/PublicTripCard";
import {
  VEHICLES, ROUTE_STYLES,
  type VehicleType, type RouteStyle,
} from "@/lib/trips-store";
import { CURATED_TRIPS, COUNTRY_LABEL, MACRO_REGION_LABEL, type Country, type CuratedTrip, type MacroRegion } from "@/lib/curated-trips";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Route as RouteIcon, ArrowRight, Users, Sparkles, LogIn, MapPin, Flag, Bookmark, Flame } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useAuth } from "@/lib/auth";

const ExploreSearch = z.object({
  tab: z.enum(["turer", "brukere"]).optional(),
  vehicle: z.enum(["motorcycle", "car", "rv"]).optional(),
});

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/explore")({
  head: () => ({
    meta: [
      { title: "Utforsk turer — Veiglede" },
      { name: "description", content: "Bla i ruter og brukere på Veiglede — finn inspirasjon til neste tur." },
      { property: "og:title", content: "Utforsk turer — Veiglede" },
      { property: "og:description", content: "Bla i ruter og brukere på Veiglede — finn inspirasjon til neste tur." },
    ],
  }),
  validateSearch: (s) => ExploreSearch.parse(s),
  component: ExplorePage,
});

function ExplorePage() {
  const t = useT();
  const ex = t.app.explore;
  const { tab = "turer", vehicle: vehicleFromUrl } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setTab = (next: "turer" | "brukere") => {
    navigate({ search: (s: z.infer<typeof ExploreSearch>) => ({ ...s, tab: next === "turer" ? undefined : next }) });
  };

  return (
    <div className="py-5 md:py-8">
      <header className="text-center md:text-left">
        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-primary">
          <Compass className="h-3 w-3" /> {ex.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{ex.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Finn turer, roadbooks og folk å følge.</p>
      </header>

      <ExploreCta />

      {/* Tabs */}
      <div className="mt-6 inline-flex rounded-2xl border border-border bg-surface p-1">
        <TabButton active={tab === "turer"} onClick={() => setTab("turer")} icon={<RouteIcon className="h-3.5 w-3.5" />}>{ex.tabTrips}</TabButton>
        <TabButton active={tab === "brukere"} onClick={() => setTab("brukere")} icon={<Users className="h-3.5 w-3.5" />}>{ex.tabUsers}</TabButton>
      </div>

      {tab === "brukere"
        ? <UsersTab vehicleFromUrl={vehicleFromUrl} />
        : <TripsTab />}
    </div>
  );
}

function ExploreCta() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Link
        to="/auth"
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/15"
      >
        <LogIn className="h-3.5 w-3.5" /> Logg inn for å kopiere turer og følge folk
      </Link>
    );
  }
  return (
    <Link
      to="/trips"
      className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary"
    >
      <Sparkles className="h-3.5 w-3.5 text-primary" /> Del en tur og inspirer andre
    </Link>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon} {children}
    </button>
  );
}

/* ============ TRIPS TAB ============ */

function TripsTab() {
  const t = useT();
  const ex = t.app.explore;
  const fetcher = useServerFn(fetchPublicTrips);
  const fetchStats = useServerFn(getTripSocialStatsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["public-trips"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });
  const trips = data ?? [];
  const tripIds = useMemo(
    () => [...trips.map((t) => t.id).filter(Boolean), ...CURATED_TRIPS.map((c) => c.id)],
    [trips],
  );

  const { data: statsMap } = useQuery({
    queryKey: ["trip-social-stats", tripIds],
    enabled: tripIds.length > 0,
    queryFn: () => fetchStats({ data: { tripIds } }),
    staleTime: 60_000,
  });
  const stats: Record<string, TripSocialStats> = statsMap ?? {};

  const [region, setRegion] = useState<string>("all");
  const [macroRegion, setMacroRegion] = useState<"all" | MacroRegion>("all");
  const [vehicle, setVehicle] = useState<"all" | VehicleType>("all");
  const [style, setStyle] = useState<"all" | RouteStyle>("all");
  const [country, setCountry] = useState<"all" | Country>("all");
  const [sort, setSort] = useState<"newest" | "most_saved" | "most_drive" | "most_reactions">("newest");

  const regions = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((tr) => { if (tr.region) set.add(tr.region); });
    CURATED_TRIPS.forEach((c) => { if (c.region) set.add(c.region); });
    return Array.from(set).sort();
  }, [trips]);

  // Curated trips matching the current filters — always available, never empty.
  const curatedFiltered = useMemo(() => {
    return CURATED_TRIPS.filter((c) => {
      if (country !== "all" && c.country !== country) return false;
      if (macroRegion !== "all" && !c.macroRegions.includes(macroRegion)) return false;
      if (region !== "all" && c.region !== region) return false;
      if (style !== "all" && c.style !== style) return false;
      if (vehicle !== "all" && !c.vehicleSuitability.includes(vehicle)) return false;
      return true;
    });
  }, [country, macroRegion, region, style, vehicle]);

  const filtered = useMemo(() => {
    // Country filter only applies to curated trips (user trips have no country yet).
    if (country !== "all") return [] as PublicTripSummary[];
    const list = trips.filter((tr) => {
      if (region !== "all" && tr.region !== region) return false;
      if (vehicle !== "all" && tr.vehicle !== vehicle) return false;
      if (style !== "all" && tr.style !== style) return false;
      return true;
    });
    const s = (id: string) => stats[id] ?? { drive: 0, saves: 0, reactions: 0 };
    if (sort === "most_saved") {
      return [...list].sort((a, b) => (s(b.id).saves + b.copyCount) - (s(a.id).saves + a.copyCount) || (b.createdAt - a.createdAt));
    }
    if (sort === "most_drive") {
      return [...list].sort((a, b) => s(b.id).drive - s(a.id).drive || (b.createdAt - a.createdAt));
    }
    if (sort === "most_reactions") {
      return [...list].sort((a, b) => s(b.id).reactions - s(a.id).reactions || (b.createdAt - a.createdAt));
    }
    return list;
  }, [trips, country, region, vehicle, style, sort, stats]);

  // "Populære turer" highlight strip: top 3 by combined save+drive intent.
  const popular = useMemo(() => {
    return [...trips]
      .map((tr) => ({ tr, score: (stats[tr.id]?.drive ?? 0) + (stats[tr.id]?.saves ?? 0) + tr.copyCount }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.tr);
  }, [trips, stats]);

  const renderCard = (tr: PublicTripSummary) => (
    <li key={tr.shareToken}>
      <PublicTripCard
        trip={{
          id: tr.id, title: tr.title, subtitle: tr.subtitle, region: tr.region,
          origin: tr.origin, destination: tr.destination,
          distanceKm: tr.distanceKm, drivingTime: tr.drivingTime, stopsCount: tr.stopsCount,
          cover: tr.cover, style: tr.style, vehicle: tr.vehicle, shareToken: tr.shareToken,
        }}
        ownerName={tr.ownerName}
        ownerUsername={tr.ownerUsername}
        ownerAvatarUrl={tr.ownerAvatarUrl}
        stats={stats[tr.id]}
        status="offentlig"
      />
    </li>
  );

  return (
    <>
      {/* Country chips */}
      <section className="mt-6 flex flex-wrap gap-2">
        <FilterPill active={country === "all"} onClick={() => setCountry("all")}>🌍 Alle land</FilterPill>
        {(["no", "se", "dk", "de"] as Country[]).map((c) => (
          <FilterPill key={c} active={country === c} onClick={() => setCountry(c)}>
            {COUNTRY_LABEL[c]}
          </FilterPill>
        ))}
      </section>

      {/* Macro-region chips (kuraterte Norges-regioner) */}
      {country === "no" || country === "all" ? (
        <section className="mt-3 flex flex-wrap gap-2">
          <FilterPill active={macroRegion === "all"} onClick={() => setMacroRegion("all")}>📍 Hele Norge</FilterPill>
          {(Object.keys(MACRO_REGION_LABEL) as MacroRegion[]).map((m) => (
            <FilterPill key={m} active={macroRegion === m} onClick={() => setMacroRegion(m)}>
              {MACRO_REGION_LABEL[m]}
            </FilterPill>
          ))}
        </section>
      ) : null}

      {/* Filters + sort */}
      <section className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger><SelectValue placeholder={ex.region} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ex.allRegions}</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vehicle} onValueChange={(v) => setVehicle(v as "all" | VehicleType)}>
          <SelectTrigger><SelectValue placeholder={ex.vehicle} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ex.allVehicles}</SelectItem>
            {VEHICLES.map((v) => <SelectItem key={v.value} value={v.value}>{v.emoji} {v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={style} onValueChange={(v) => setStyle(v as "all" | RouteStyle)}>
          <SelectTrigger><SelectValue placeholder={ex.routeStyle} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{ex.allStyles}</SelectItem>
            {ROUTE_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger><SelectValue placeholder="Sortering" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Nyeste</SelectItem>
            <SelectItem value="most_drive">🏁 Mest "Vil kjøre"</SelectItem>
            <SelectItem value="most_saved">💾 Mest lagret</SelectItem>
            <SelectItem value="most_reactions">🔥 Mest reaksjoner</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Curated — always available, never empty */}
      {curatedFiltered.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-primary">
                <Sparkles className="h-3 w-3" /> Kuratert av Veiglede
              </p>
              <h2 className="font-display text-xl uppercase mt-1">Inspirasjon for neste tur</h2>
              <p className="text-xs text-muted-foreground">Ekte ruter med roadbook, klare til å kopieres eller tilpasses.</p>
            </div>
          </div>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {curatedFiltered.map((c) => (
              <li key={c.slug}><CuratedTripCard trip={c} stats={stats[c.id]} /></li>
            ))}
          </ul>
        </section>
      )}

      {/* Populære turer */}
      {popular.length > 0 && sort === "newest" && country === "all" && (
        <section className="mt-8">
          <h2 className="font-display text-xl uppercase">Populære turer fra fellesskapet</h2>
          <p className="text-xs text-muted-foreground">Turene som andre lagrer og vil kjøre akkurat nå.</p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map(renderCard)}
          </ul>
        </section>
      )}

      {/* Main list */}
      <section className="mt-8">
        <h2 className="font-display text-xl uppercase">
          {sort === "most_drive" ? "Mest «Vil kjøre»"
            : sort === "most_saved" ? "Mest lagret"
            : sort === "most_reactions" ? "Mest reaksjoner"
            : "Nye offentlige turer"}
        </h2>
        {isLoading ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl border border-border bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          trips.length === 0 ? (
            <EmptyState title="Det finnes ingen offentlige turer enda." body={ex.emptyTripsBody} />
          ) : (
            <EmptyState title={ex.noMatchTitle} body={ex.noMatchBody} />
          )
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(renderCard)}
          </ul>
        )}
      </section>
    </>
  );
}

/* ============ USERS TAB ============ */

function UsersTab({ vehicleFromUrl }: { vehicleFromUrl?: VehicleType }) {
  const tt = useT();
  const ex = tt.app.explore;
  const fetcher = useServerFn(fetchPublicProfilesFn);
  const { data, isLoading } = useQuery({
    queryKey: ["public-profiles"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });
  const users = data ?? [];

  const [vehicleFilter, setVehicleFilter] = useState<"all" | VehicleType>(vehicleFromUrl ?? "all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (vehicleFilter === "all") return users;
    return users.filter((u) => u.vehicleTypes.includes(vehicleFilter));
  }, [users, vehicleFilter]);

  const shown = filtered.slice(0, visible);

  return (
    <>
      <section className="mt-6 flex flex-wrap gap-2">
        <FilterPill active={vehicleFilter === "all"} onClick={() => { setVehicleFilter("all"); setVisible(PAGE_SIZE); }}>
          {ex.filterAll}
        </FilterPill>
        {VEHICLES.map((v) => (
          <FilterPill
            key={v.value}
            active={vehicleFilter === v.value}
            onClick={() => { setVehicleFilter(v.value); setVisible(PAGE_SIZE); }}
          >
            <span>{v.emoji}</span> {v.label}
          </FilterPill>
        ))}
      </section>

      <section className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl border border-border bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          users.length === 0 ? (
            <EmptyState title={ex.emptyUsersTitle} body={ex.emptyUsersBody} />
          ) : (
            <EmptyState title={ex.noUsersMatchTitle} body={ex.noUsersMatchBody} />
          )
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((u) => <PublicUserCard key={u.id} user={u} />)}
            </ul>
            {visible < filtered.length && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-5 py-2 text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary"
                >
                  {ex.loadMore} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

/* ============ CURATED CARD ============ */

function CuratedTripCard({ trip, stats }: { trip: CuratedTrip; stats?: TripSocialStats }) {
  return (
    <Link
      to="/inspirasjon/$slug"
      params={{ slug: trip.slug }}
      className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/60 transition-colors h-full"
    >
      <div className="relative h-32">
        <img src={trip.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
          <Sparkles className="h-2.5 w-2.5" /> Kuratert
        </span>
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border border-border bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] text-muted-foreground">
          {COUNTRY_LABEL[trip.country]}
        </span>
      </div>
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-wider text-primary">{trip.region}</p>
        <h3 className="mt-0.5 font-display text-lg uppercase leading-tight group-hover:text-primary">{trip.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{trip.shortDescription}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
          <MapPin className="h-3 w-3 shrink-0 text-primary" />
          {trip.origin} → {trip.destination}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><RouteIcon className="h-3 w-3" /> {trip.distanceKm} km</span>
          <span className="inline-flex items-center gap-1"><Compass className="h-3 w-3" /> {trip.stopsCount} stopp</span>
          <span className="inline-flex items-center gap-1 truncate" title={trip.drivingTime}>{trip.drivingTime}</span>
        </div>
        {stats && (stats.drive > 0 || stats.saves > 0 || stats.reactions > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stats.drive > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Flag className="h-3 w-3" /> {stats.drive} vil kjøre
              </span>
            )}
            {stats.saves > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                <Bookmark className="h-3 w-3" /> {stats.saves} lagret
              </span>
            )}
            {stats.reactions > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                <Flame className="h-3 w-3" /> {stats.reactions} reaksjoner
              </span>
            )}
          </div>
        )}
        <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
          Se roadbook <ArrowRight className="h-3 w-3" />
        </p>
      </div>
    </Link>
  );
}

/* ============ EMPTY STATE ============ */

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
      <Compass className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="mt-3 font-display text-2xl uppercase">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
