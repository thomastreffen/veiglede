import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicTrips, type PublicTripSummary } from "@/lib/public-trips";
import {
  COVERS, VEHICLES, ROUTE_STYLES, vehicleMeta, styleMeta,
  type CoverKey, type VehicleType, type RouteStyle,
} from "@/lib/trips-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Compass, MapPin, Clock, Route as RouteIcon, Camera, ArrowRight, Sparkles, Share2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/explore")({
  head: () => ({
    meta: [
      { title: "Utforsk turer — Veiglede" },
      { name: "description", content: "Bla i ruter delt av Veiglede-brukere — finn inspirasjon til neste tur." },
      { property: "og:title", content: "Utforsk turer — Veiglede" },
      { property: "og:description", content: "Bla i ruter delt av Veiglede-brukere — finn inspirasjon til neste tur." },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
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
    trips.forEach((t) => { if (t.region) set.add(t.region); });
    return Array.from(set).sort();
  }, [trips]);

  const filtered = useMemo(() => trips.filter((t) => {
    if (region !== "all" && t.region !== region) return false;
    if (vehicle !== "all" && t.vehicle !== vehicle) return false;
    if (style !== "all" && t.style !== style) return false;
    return true;
  }), [trips, region, vehicle, style]);

  return (
    <div className="py-5 md:py-8">
      <header className="text-center md:text-left">
        <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-primary">
          <Compass className="h-3 w-3" /> Fellesskap
        </p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase leading-[0.95]">Utforsk turer</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ruter delt av Veiglede-brukere</p>
      </header>

      {/* Filters */}
      <section className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle regioner</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vehicle} onValueChange={(v) => setVehicle(v as "all" | VehicleType)}>
          <SelectTrigger><SelectValue placeholder="Kjøretøy" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kjøretøy</SelectItem>
            {VEHICLES.map((v) => <SelectItem key={v.value} value={v.value}>{v.emoji} {v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={style} onValueChange={(v) => setStyle(v as "all" | RouteStyle)}>
          <SelectTrigger><SelectValue placeholder="Rutestil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle stiler</SelectItem>
            {ROUTE_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {/* Results */}
      <section className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl border border-border bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          trips.length === 0 ? (
            <EmptyState
              title="Ingen offentlige turer enda — del din første!"
              body="Slå på «Offentlig deling» på en av dine turer for å vise den her."
            />
          ) : (
            <EmptyState title="Ingen turer matcher filtrene" body="Prøv å nullstille filtrene." />
          )
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => <PublicTripCard key={t.shareToken} t={t} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function PublicTripCard({ t }: { t: PublicTripSummary }) {
  const v = vehicleMeta(t.vehicle as VehicleType);
  const s = styleMeta(t.style as RouteStyle);
  const cover = (t.cover as CoverKey) ?? "fjord";
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
            <Sparkles className="h-3 w-3 text-primary" /> Offentlig
          </span>
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider border border-border">
            {v.emoji} {s.emoji}
          </span>
        </div>
        <div className="p-4 md:p-5">
          {t.region && <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}</p>}
          <h3 className="mt-1 font-display text-xl uppercase leading-tight group-hover:text-primary transition-colors">{t.title}</h3>
          {t.subtitle && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.subtitle}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} v={`${t.distanceKm} km`} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} v={t.drivingTime} />
            <Stat icon={<Camera className="h-3.5 w-3.5" />} v={`${t.stopsCount} stopp`} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
            <span className="inline-flex items-center gap-1 truncate min-w-0"><MapPin className="h-3 w-3 shrink-0" /> {t.origin} → {t.destination}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground truncate">{t.ownerName ? `av ${t.ownerName}` : "av en reisende"}</span>
            <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">Se tur <ArrowRight className="h-3 w-3" /></span>
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
