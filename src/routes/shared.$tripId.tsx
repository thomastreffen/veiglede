import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useTripsStore, stopMeta, vehicleMeta, styleMeta, COVERS, type CoverKey,
} from "@/lib/trips-store";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { publicPlaceName } from "@/lib/public-place";
import {
  ArrowLeft, MapPin, Clock, Route as RouteIcon, Sparkles, Eye, Lock,
  Radio, Camera, Users, BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/shared/$tripId")({
  head: () => ({ meta: [{ title: "Delt tur — Veiglede" }] }),
  component: SharedTrip,
});

function SharedTrip() {
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const trip = trips.find((t) => t.id === tripId);

  if (!trip) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="mt-3 font-display text-2xl uppercase">Denne turen finnes ikke</p>
          <p className="mt-1 text-sm text-muted-foreground">Lenken kan være utløpt eller privat.</p>
          <Link to="/" className="mt-5 inline-flex text-sm text-primary underline">Tilbake til Veiglede</Link>
        </div>
      </div>
    );
  }

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Public top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Veiglede"><VeigledeLogo size="md" /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Eye className="h-3 w-3" /> Delt visning
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-16">
        <Link to="/trips/$tripId" params={{ tripId }} className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Tilbake til planlegger
        </Link>

        {/* Hero */}
        <section className={`mt-4 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${COVERS[trip.cover as CoverKey]} p-6 md:p-8`}>
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Delt av en reisende</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{trip.title}</h1>
            {trip.subtitle && <p className="mt-2 text-sm text-foreground/80">{trip.subtitle}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{v.emoji} {v.label}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{s.emoji} {s.label}</span>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          {[
            { Icon: RouteIcon, label: "Distanse", value: `${trip.distanceKm} km` },
            { Icon: Clock, label: "Kjøretid", value: trip.drivingTime },
            { Icon: Camera, label: "Dager", value: String(tripDays.length) },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-3">
              <Icon className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-xl uppercase">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {/* Live placeholder */}
        <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary font-bold">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Live-reise (kommer snart)
          </p>
          <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
            Når den reisende er underveis, vil du her kunne se posisjon, siste besøkte stopp,
            neste planlagte stopp og bilder fra turen.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> Nåværende posisjon</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-primary" /> Neste stopp</span>
            <span className="inline-flex items-center gap-1.5"><Camera className="h-3 w-3 text-primary" /> Bilder underveis</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-primary" /> Følgere</span>
          </div>
        </section>

        {/* AI summary */}
        {trip.aiSummary && (
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
              <Sparkles className="h-4 w-4" /> Om denne ruta
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
          </section>
        )}

        {/* Days (read-only) */}
        <section className="mt-6">
          <h2 className="font-display text-2xl uppercase">Dag for dag</h2>
          <ol className="mt-3 space-y-3">
            {tripDays.map((day) => {
              const dayStops = stops.filter((st) => st.dayId === day.id).sort((a, b) => a.order - b.order);
              return (
                <li key={day.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-2xl uppercase text-primary">Dag {day.dayNumber}</span>
                    {day.date && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{day.date}</span>}
                  </div>
                  <p className="font-display text-lg uppercase">{day.title}</p>
                  {day.summary && <p className="text-xs text-muted-foreground mt-0.5">{day.summary}</p>}
                  <ul className="mt-3 space-y-2">
                    {dayStops.map((stop) => {
                      const meta = stopMeta(stop.type);
                      return (
                        <li key={stop.id} className="flex items-start gap-2.5 text-sm">
                          <span className="h-7 w-7 rounded-lg bg-surface-2 grid place-items-center shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{stop.name}</p>
                            {stop.location && <p className="text-[11px] text-muted-foreground">{stop.location}</p>}
                          </div>
                          {stop.estimatedTime && <span className="text-[11px] text-muted-foreground shrink-0">{stop.estimatedTime}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Footer CTA */}
        <section className="mt-8 rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-xs text-muted-foreground">
            Vil du planlegge din egen tur?
          </p>
          <Link to="/" className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
            Prøv Veiglede
          </Link>
        </section>
      </div>
    </div>
  );
}
