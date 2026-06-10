import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { fetchPublicTrips, type PublicTripSummary } from "@/lib/public-trips";
import { fetchPublicProfilesFn } from "@/lib/public-profiles.functions";
import { PublicUserCard } from "@/components/PublicUserCard";
import { PublicTripCard } from "@/components/PublicTripCard";
import {
  VEHICLES, ROUTE_STYLES,
  type VehicleType, type RouteStyle,
} from "@/lib/trips-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Route as RouteIcon, ArrowRight, Users, Sparkles, LogIn } from "lucide-react";
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
  const { data, isLoading } = useQuery({
    queryKey: ["public-trips"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });
  const trips = data ?? [];

  const [region, setRegion] = useState<string>("all");
  const [vehicle, setVehicle] = useState<"all" | VehicleType>("all");
  const [style, setStyle] = useState<"all" | RouteStyle>("all");
  const [sort, setSort] = useState<"newest" | "popular">("newest");

  const regions = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((tr) => { if (tr.region) set.add(tr.region); });
    return Array.from(set).sort();
  }, [trips]);

  const filtered = useMemo(() => {
    const list = trips.filter((tr) => {
      if (region !== "all" && tr.region !== region) return false;
      if (vehicle !== "all" && tr.vehicle !== vehicle) return false;
      if (style !== "all" && tr.style !== style) return false;
      return true;
    });
    if (sort === "popular") {
      return [...list].sort((a, b) => (b.copyCount - a.copyCount) || (b.createdAt - a.createdAt));
    }
    return list;
  }, [trips, region, vehicle, style, sort]);

  // "Populære turer" highlight strip: top 3 by copyCount (only when there are copies).
  const popular = useMemo(() => {
    return [...trips]
      .filter((tr) => tr.copyCount > 0)
      .sort((a, b) => b.copyCount - a.copyCount)
      .slice(0, 3);
  }, [trips]);

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
        status="offentlig"
      />
    </li>
  );

  return (
    <>
      {/* Filters + sort */}
      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
        <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "popular")}>
          <SelectTrigger><SelectValue placeholder="Sortering" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Nyeste</SelectItem>
            <SelectItem value="popular">Mest lagret</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Populære turer */}
      {popular.length > 0 && sort === "newest" && (
        <section className="mt-8">
          <h2 className="font-display text-xl uppercase">Populære turer</h2>
          <p className="text-xs text-muted-foreground">Turene som andre lagrer akkurat nå.</p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map(renderCard)}
          </ul>
        </section>
      )}

      {/* Main list */}
      <section className="mt-8">
        <h2 className="font-display text-xl uppercase">
          {sort === "popular" ? "Mest lagret" : "Nye offentlige turer"}
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
