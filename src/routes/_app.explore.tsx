import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { fetchPublicTrips, type PublicTripSummary } from "@/lib/public-trips";
import { publicPlaceName } from "@/lib/public-place";
import { fetchPublicProfilesFn } from "@/lib/public-profiles.functions";
import { PublicUserCard } from "@/components/PublicUserCard";
import {
  COVERS, VEHICLES, ROUTE_STYLES, vehicleMeta, styleMeta,
  type CoverKey, type VehicleType, type RouteStyle,
} from "@/lib/trips-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Compass, MapPin, Clock, Route as RouteIcon, Camera, ArrowRight, Sparkles, Share2, Users,
} from "lucide-react";
import { TripReactionsRow } from "@/components/TripReactionsRow";
import { SaveTripButton } from "@/components/SaveTripButton";
import { useT } from "@/i18n/provider";

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
        <p className="mt-2 text-sm text-muted-foreground">{ex.subtitle}</p>
      </header>

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

  const regions = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((tr) => { if (tr.region) set.add(tr.region); });
    return Array.from(set).sort();
  }, [trips]);

  const filtered = useMemo(() => trips.filter((tr) => {
    if (region !== "all" && tr.region !== region) return false;
    if (vehicle !== "all" && tr.vehicle !== vehicle) return false;
    if (style !== "all" && tr.style !== style) return false;
    return true;
  }), [trips, region, vehicle, style]);

  return (
    <>
      {/* Filters */}
      <section className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
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
      </section>

      <section className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl border border-border bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          trips.length === 0 ? (
            <EmptyState title={ex.emptyTripsTitle} body={ex.emptyTripsBody} />
          ) : (
            <EmptyState title={ex.noMatchTitle} body={ex.noMatchBody} />
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tr) => <PublicTripCard key={tr.shareToken} t={tr} />)}
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

/* ============ TRIP CARD ============ */

function PublicTripCard({ t }: { t: PublicTripSummary }) {
  const tt = useT();
  const ex = tt.app.explore;
  const v = vehicleMeta(t.vehicle as VehicleType);
  const s = styleMeta(t.style as RouteStyle);
  const cover = (t.cover as CoverKey) ?? "fjord";
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shared/${t.shareToken}`
    : `/shared/${t.shareToken}`;
  const pubOrigin = publicPlaceName(t.origin);
  const pubDest = publicPlaceName(t.destination);
  const onShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const data = { title: t.title, text: t.subtitle ?? `${pubOrigin} → ${pubDest}`, url: shareUrl };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share(data); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(shareUrl); toast.success(ex.linkCopied); }
    catch { toast.error(ex.shareFailed); }
  };
  return (
    <li>
      <Link
        to="/shared/$shareToken"
        params={{ shareToken: t.shareToken }}
        className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/60 transition-colors"
      >
        <div className={`relative h-28 bg-gradient-to-br ${COVERS[cover]}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider border border-border">
            <Sparkles className="h-3 w-3 text-primary" /> {ex.publicBadge}
          </span>
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider border border-border">
            {v.emoji} {s.emoji}
          </span>
          <button
            onClick={onShare}
            aria-label={ex.shareTrip}
            className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border text-foreground hover:bg-primary hover:text-primary-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-4 md:p-5">
          {t.region && <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}</p>}
          <h3 className="mt-1 font-display text-xl uppercase leading-tight group-hover:text-primary transition-colors">{t.title}</h3>
          {t.subtitle && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.subtitle}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} v={`${t.distanceKm} km`} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} v={t.drivingTime} />
            <Stat icon={<Camera className="h-3.5 w-3.5" />} v={`${t.stopsCount} ${ex.stops}`} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
            <span className="inline-flex items-center gap-1 truncate min-w-0"><MapPin className="h-3 w-3 shrink-0" /> {t.origin} → {t.destination}</span>
          </div>
          <div className="mt-3" onClick={(e) => e.preventDefault()}>
            <TripReactionsRow tripId={t.id} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]" onClick={(e) => e.preventDefault()}>
            <SaveTripButton payload={{
              sourceTripId: t.id, title: t.title, subtitle: t.subtitle, region: t.region,
              origin: t.origin, destination: t.destination, distanceKm: t.distanceKm,
              drivingTime: t.drivingTime, cover: t.cover, style: t.style, vehicle: t.vehicle,
            }} />
            <span className="text-muted-foreground truncate">{t.ownerName ? `${ex.by} ${t.ownerName}` : ex.byTraveler}</span>
            <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">{ex.seeTrip} <ArrowRight className="h-3 w-3" /></span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function Stat({ icon, v }: { icon: React.ReactNode; v: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {icon}<span className="truncate">{v}</span>
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
      <Compass className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="mt-3 font-display text-2xl uppercase">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
