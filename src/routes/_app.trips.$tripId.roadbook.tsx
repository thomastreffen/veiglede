import { createFileRoute, Link } from "@tanstack/react-router";
import { useTripsStore, stopMeta, vehicleMeta, styleMeta } from "@/lib/trips-store";
import { ArrowLeft, Clock, Share2, Download } from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId/roadbook")({
  head: () => ({ meta: [{ title: "Roadbook — Veiglede" }] }),
  component: Roadbook,
});

function Roadbook() {
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return <div className="py-10">Tur ikke funnet.</div>;

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Planlegger
        </Link>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary"><Share2 className="h-3.5 w-3.5" /> Del</button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary"><Download className="h-3.5 w-3.5" /> Eksport</button>
        </div>
      </div>

      <header className="mt-6 text-center max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Roadbook</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
        <p className="mt-3 text-muted-foreground">{trip.origin} → {trip.destination}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{v.emoji} {v.label}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{s.emoji} {s.label}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{trip.distanceKm} km · {trip.drivingTime}</span>
        </div>
      </header>

      <div className="mt-10 space-y-10 max-w-2xl mx-auto">
        {tripDays.map((day) => {
          const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
          return (
            <section key={day.id} className="rounded-2xl border border-border bg-surface p-5 md:p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl uppercase text-primary">Dag {day.dayNumber}</span>
                {day.date && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{day.date}</span>}
              </div>
              <h2 className="mt-1 font-display text-2xl md:text-3xl uppercase">{day.title}</h2>
              {day.summary && <p className="mt-2 text-sm text-muted-foreground">{day.summary}</p>}

              <ol className="mt-6 relative border-l-2 border-border ml-3 space-y-5">
                {dayStops.map((stop) => {
                  const meta = stopMeta(stop.type);
                  return (
                    <li key={stop.id} className="pl-6 relative">
                      <span className="absolute -left-[15px] top-0.5 h-7 w-7 rounded-full bg-background border-2 border-primary grid place-items-center text-sm">{meta.emoji}</span>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-semibold">{stop.name}</h3>
                        {stop.estimatedTime && <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" />{stop.estimatedTime}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta.label}{stop.location ? ` · ${stop.location}` : ""}
                      </p>
                      {stop.notes && <p className="mt-2 text-sm leading-relaxed text-foreground/90">{stop.notes}</p>}
                    </li>
                  );
                })}
                {dayStops.length === 0 && <li className="pl-6 text-sm text-muted-foreground italic">En åpen dag.</li>}
              </ol>
            </section>
          );
        })}

        <section className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <p className="font-display uppercase text-foreground text-base">Praktisk info</p>
          <ul className="mt-3 space-y-1.5">
            <li>· Total distanse: {trip.distanceKm} km over {tripDays.length} {tripDays.length === 1 ? "dag" : "dager"}</li>
            <li>· Anslått kjøretid: {trip.drivingTime}</li>
            <li>· Kjøretøy: {v.label} · stil: {s.label}</li>
            {trip.startDate && <li>· Avreise: {new Date(trip.startDate).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</li>}
            <li>· Husk: kart offline, kontanter til bomvei, lader</li>
          </ul>
        </section>

      </div>

      <div className="mt-12 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">— slutt på roadbook —</div>
    </div>
  );
}
