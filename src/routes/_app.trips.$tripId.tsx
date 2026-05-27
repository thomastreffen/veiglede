import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTripsStore, tripsApi, stopMeta, STOP_TYPES } from "@/lib/trips-store";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { Plus, Trash2, ArrowLeft, BookOpen, Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId")({
  head: ({ params }) => ({ meta: [{ title: `Trip — Roadbook` }] }),
  component: TripPlanner,
});

function TripPlanner() {
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const navigate = useNavigate();
  const trip = trips.find((t) => t.id === tripId);

  if (!trip) {
    return (
      <div className="py-10 text-center">
        <p className="font-serif text-2xl">Trip not found</p>
        <Link to="/trips" className="mt-4 inline-block text-sm text-primary underline">Back to trips</Link>
      </div>
    );
  }

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div className="py-4">
      <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Trips
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{trip.startDate ?? "Anytime"} {trip.endDate ? `· ${trip.endDate}` : ""}</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl leading-tight">{trip.title}</h1>
          {trip.subtitle && <p className="mt-2 text-muted-foreground max-w-xl">{trip.subtitle}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/trips/$tripId/roadbook" params={{ tripId }} className="inline-flex items-center gap-1.5 rounded-full border border-input px-4 py-2 text-sm hover:bg-secondary">
            <BookOpen className="h-4 w-4" /> Roadbook
          </Link>
          <button onClick={() => { if (confirm("Delete this trip?")) { tripsApi.deleteTrip(tripId); navigate({ to: "/trips" }); } }} className="inline-flex items-center justify-center rounded-full border border-input h-9 w-9 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mt-6">
        <MapPlaceholder height="h-52 md:h-72" labels={[trip.origin, trip.destination]} />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <h2 className="font-serif text-2xl">Day stages</h2>
        <button onClick={() => tripsApi.addDay(tripId)} className="inline-flex items-center gap-1.5 rounded-full border border-input px-3.5 py-2 text-sm hover:bg-secondary">
          <Plus className="h-4 w-4" /> Add day
        </button>
      </div>

      <ol className="mt-4 space-y-4">
        {tripDays.map((day) => {
          const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
          return (
            <li key={day.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-start gap-4 p-5 border-b border-border/60">
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-serif text-lg leading-none shrink-0">{day.dayNumber}</div>
                <div className="flex-1 min-w-0">
                  <input
                    value={day.title}
                    onChange={(e) => tripsApi.updateDay(day.id, { title: e.target.value })}
                    className="w-full font-serif text-2xl bg-transparent outline-none focus:bg-secondary/50 rounded px-1 -mx-1"
                  />
                  <input
                    value={day.summary ?? ""}
                    placeholder="A short note about this day…"
                    onChange={(e) => tripsApi.updateDay(day.id, { summary: e.target.value })}
                    className="mt-1 w-full text-sm text-muted-foreground bg-transparent outline-none focus:bg-secondary/50 rounded px-1 -mx-1"
                  />
                </div>
                <button onClick={() => { if (confirm("Delete this day?")) tripsApi.deleteDay(day.id); }} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <ul className="divide-y divide-border/60">
                {dayStops.map((stop) => {
                  const meta = stopMeta(stop.type);
                  return (
                    <li key={stop.id}>
                      <Link to="/trips/$tripId/stops/$stopId" params={{ tripId, stopId: stop.id }} className="flex items-center gap-4 p-4 hover:bg-secondary/40 transition-colors">
                        <span className="h-9 w-9 rounded-full bg-secondary text-foreground grid place-items-center text-base shrink-0">{meta.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{stop.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="capitalize">{meta.label}</span>
                            {stop.estimatedTime && <><span>·</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{stop.estimatedTime}</span></>}
                            {stop.location && <><span>·</span><span>{stop.location}</span></>}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {dayStops.length === 0 && (
                  <li className="px-5 py-6 text-sm text-muted-foreground italic">No stops yet for this day.</li>
                )}
              </ul>

              <div className="p-3 bg-secondary/30 border-t border-border/60 flex gap-2 flex-wrap">
                {STOP_TYPES.slice(0, 5).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      const stop = tripsApi.addStop(day.id, { type: t.value, name: `New ${t.label.toLowerCase()}` });
                      navigate({ to: "/trips/$tripId/stops/$stopId", params: { tripId, stopId: stop.id } });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-background border border-border px-3 py-1.5 text-xs hover:border-primary"
                  >
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
