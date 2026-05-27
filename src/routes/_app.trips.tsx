import { createFileRoute, Link } from "@tanstack/react-router";
import { useTripsStore, COVERS, vehicleMeta, styleMeta, FEATURED_ROUTES, type CoverKey } from "@/lib/trips-store";
import { Plus, MapPin, Clock, Route as RouteIcon, Camera, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/trips")({
  head: () => ({ meta: [{ title: "Mine turer — Veiglede" }] }),
  component: TripsDashboard,
});

function TripsDashboard() {
  const { trips } = useTripsStore();

  return (
    <div className="py-5 md:py-8">
      {/* Stats strip */}
      <section className="grid grid-cols-4 gap-3 md:gap-6 rounded-2xl border border-border bg-surface/70 p-4 md:p-6">
        {[
          { n: String(trips.length), l: "planlagte turer" },
          { n: trips.reduce((a, t) => a + t.distanceKm, 0).toLocaleString("nb-NO"), l: "km totalt" },
          { n: "3", l: "kjøretøy" },
          { n: "47", l: "fotostopp" },
        ].map((s) => (
          <div key={s.l}>
            <p className="font-display text-2xl md:text-4xl">{s.n}</p>
            <p className="mt-1 text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider leading-tight">{s.l}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Mine turer</p>
          <h1 className="mt-1 font-display text-3xl md:text-5xl uppercase">{trips.length} turer</h1>
        </div>
        <Link to="/trips/new" className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" strokeWidth={3} /> Ny tur
        </Link>
      </div>

      {trips.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => <TripCard key={t.id} t={t} />)}
        </ul>
      )}

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
  return (
    <li>
      <Link to="/trips/$tripId" params={{ tripId: t.id }} className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 transition-colors">
        <div className={`relative h-36 bg-gradient-to-br ${COVERS[t.cover as CoverKey]}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <svg className="absolute inset-0 h-full w-full opacity-50" viewBox="0 0 200 80" preserveAspectRatio="none">
            <path d="M0,60 C40,45 60,15 100,30 C140,45 160,10 200,20" fill="none" stroke="oklch(0.78 0.17 65 / 0.55)" strokeWidth="1.5" />
          </svg>
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2.5 py-1 text-[10px] uppercase tracking-wider border border-border">
            <span>{s.emoji}</span> {s.label}
          </span>
          <span className="absolute top-3 right-3 text-xl">{v.emoji}</span>
        </div>
        <div className="p-4 md:p-5">
          <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}</p>
          <h3 className="mt-1 font-display text-xl md:text-2xl uppercase leading-tight group-hover:text-primary transition-colors">{t.title}</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <Stat icon={<RouteIcon className="h-3.5 w-3.5" />} v={`${t.distanceKm} km`} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} v={t.drivingTime} />
            <Stat icon={<Camera className="h-3.5 w-3.5" />} v={`${t.stopsCount} stopp`} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.origin} → {t.destination}</span>
            {t.startDate && <span>{formatDate(t.startDate)}</span>}
          </div>
        </div>
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
