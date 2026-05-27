import { createFileRoute, Link } from "@tanstack/react-router";
import { useTripsStore, stopMeta } from "@/lib/trips-store";
import { ArrowLeft, Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId/roadbook")({
  head: () => ({ meta: [{ title: "Roadbook — day by day" }] }),
  component: Roadbook,
});

function Roadbook() {
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return <div className="py-10">Trip not found.</div>;

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div className="py-4">
      <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Planner
      </Link>

      <header className="mt-6 text-center max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">The Roadbook</p>
        <h1 className="mt-3 font-serif text-5xl md:text-6xl leading-[1.02]">{trip.title}</h1>
        <p className="mt-3 text-muted-foreground italic font-serif text-lg">{trip.origin} — {trip.destination}</p>
        <div className="mt-6 mx-auto h-px w-16 bg-border" />
      </header>

      <div className="mt-10 space-y-14 max-w-2xl mx-auto">
        {tripDays.map((day) => {
          const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
          return (
            <section key={day.id}>
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-3xl text-primary">Day {day.dayNumber}</span>
                {day.date && <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{day.date}</span>}
              </div>
              <h2 className="mt-1 font-serif text-3xl">{day.title}</h2>
              {day.summary && <p className="mt-2 text-muted-foreground italic">{day.summary}</p>}

              <ol className="mt-6 relative border-l border-border ml-3 space-y-5">
                {dayStops.map((stop) => {
                  const meta = stopMeta(stop.type);
                  return (
                    <li key={stop.id} className="pl-6 relative">
                      <span className="absolute -left-[13px] top-1 h-6 w-6 rounded-full bg-background border border-border grid place-items-center text-[11px]">{meta.emoji}</span>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-medium">{stop.name}</h3>
                        {stop.estimatedTime && <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" />{stop.estimatedTime}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {meta.label}{stop.location ? ` · ${stop.location}` : ""}
                      </p>
                      {stop.notes && <p className="mt-2 text-sm leading-relaxed">{stop.notes}</p>}
                    </li>
                  );
                })}
                {dayStops.length === 0 && <li className="pl-6 text-sm text-muted-foreground italic">An open day. Drive, wander, see what happens.</li>}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="mt-16 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">— end of roadbook —</div>
    </div>
  );
}
