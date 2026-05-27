import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTripsStore, tripsApi, stopMeta, STOP_TYPES, vehicleMeta, styleMeta, COVERS, type CoverKey } from "@/lib/trips-store";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { Plus, Trash2, ArrowLeft, BookOpen, Clock, MapPin, Route as RouteIcon, Camera, Sparkles, Share2, ChevronUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId")({
  head: () => ({ meta: [{ title: "Tur — Veiglede" }] }),
  component: TripPlanner,
});

function TripPlanner() {
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const navigate = useNavigate();
  const trip = trips.find((t) => t.id === tripId);

  if (!trip) {
    return (
      <div className="py-12 text-center">
        <p className="font-display text-2xl uppercase">Tur ikke funnet</p>
        <Link to="/trips" className="mt-4 inline-block text-sm text-primary underline">Tilbake til mine turer</Link>
      </div>
    );
  }

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);
  const totalStops = stops.filter((st) => tripDays.some((d) => d.id === st.dayId)).length;

  return (
    <div className="py-4">
      <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mine turer
      </Link>

      {/* Hero cover */}
      <section className={`mt-4 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${COVERS[trip.cover as CoverKey]} p-5 md:p-8`}>
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
        <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,180 C80,160 120,80 200,100 C280,120 320,40 400,60" fill="none" stroke="oklch(0.78 0.17 65 / 0.6)" strokeWidth="2" />
        </svg>
        <div className="relative">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">
              {v.emoji} {v.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">
              {s.emoji} {s.label}
            </span>
            {trip.region && <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{trip.region}</span>}
          </div>
          <h1 className="mt-5 font-display text-4xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
          {trip.subtitle && <p className="mt-2 text-sm md:text-base text-foreground/80">{trip.subtitle}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}</p>
        </div>
      </section>

      {/* Stat row */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <BigStat icon={<RouteIcon className="h-4 w-4" />} label="Distanse" value={`${trip.distanceKm} km`} />
        <BigStat icon={<Clock className="h-4 w-4" />} label="Kjøretid" value={trip.drivingTime} />
        <BigStat icon={<Camera className="h-4 w-4" />} label="Stopp" value={String(totalStops)} />
      </section>

      {/* Map */}
      <section className="mt-4">
        <MapPlaceholder height="h-44 md:h-64" labels={[trip.origin, trip.destination]} distance={`${trip.distanceKm} km`} time={trip.drivingTime} />
      </section>

      {/* AI explanation */}
      {trip.aiSummary && (
        <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
            <Sparkles className="h-4 w-4" /> AI ko-pilot
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
        </section>
      )}

      {/* Primary actions */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/trips/$tripId/roadbook" params={{ tripId }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          <BookOpen className="h-4 w-4" /> Åpne roadbook
        </Link>
        <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3.5 text-sm font-medium hover:bg-surface-2">
          <Share2 className="h-4 w-4" /> Del
        </button>
      </section>

      {/* Days */}
      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl uppercase">Dag for dag</h2>
          <button onClick={() => tripsApi.addDay(tripId)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs uppercase tracking-wider hover:border-primary">
            <Plus className="h-3.5 w-3.5" /> Legg til dag
          </button>
        </div>

        <ol className="mt-4 space-y-4">
          {tripDays.map((day) => {
            const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
            return (
              <li key={day.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="flex items-start gap-4 p-4 md:p-5 border-b border-border/60">
                  <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display text-xl shrink-0">{day.dayNumber}</div>
                  <div className="flex-1 min-w-0">
                    <input value={day.title} onChange={(e) => tripsApi.updateDay(day.id, { title: e.target.value })}
                      className="w-full font-display text-xl md:text-2xl uppercase bg-transparent outline-none focus:bg-surface-2 rounded px-1 -mx-1" />
                    <input value={day.summary ?? ""} placeholder="Kort beskrivelse av dagen…"
                      onChange={(e) => tripsApi.updateDay(day.id, { summary: e.target.value })}
                      className="mt-1 w-full text-sm text-muted-foreground bg-transparent outline-none focus:bg-surface-2 rounded px-1 -mx-1" />
                  </div>
                  <button onClick={() => { if (confirm("Slette dagen?")) tripsApi.deleteDay(day.id); }} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <ul className="divide-y divide-border/60">
                  {dayStops.map((stop, idx) => {
                    const meta = stopMeta(stop.type);
                    return (
                      <li key={stop.id} className="flex items-stretch">
                        <Link to="/trips/$tripId/stops/$stopId" params={{ tripId, stopId: stop.id }} className="flex flex-1 items-center gap-3 p-4 hover:bg-surface-2/60 transition-colors min-w-0">
                          <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-lg shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{stop.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                              <span>{meta.label}</span>
                              {stop.estimatedTime && <><span>·</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{stop.estimatedTime}</span></>}
                              {stop.location && <><span>·</span><span>{stop.location}</span></>}
                            </p>
                          </div>
                        </Link>
                        <div className="flex flex-col items-center justify-center border-l border-border/60 px-1">
                          <button onClick={() => tripsApi.moveStop(stop.id, -1)} disabled={idx === 0}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label="Flytt opp">
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button onClick={() => tripsApi.moveStop(stop.id, 1)} disabled={idx === dayStops.length - 1}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label="Flytt ned">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {dayStops.length === 0 && (
                    <li className="px-5 py-6 text-sm text-muted-foreground italic">Ingen stopp på denne dagen enda.</li>
                  )}
                </ul>


                <div className="p-3 bg-background/40 border-t border-border/60 flex gap-2 overflow-x-auto">
                  {STOP_TYPES.slice(0, 6).map((t) => (
                    <button key={t.value}
                      onClick={() => {
                        const stop = tripsApi.addStop(day.id, { type: t.value, name: `Nytt ${t.label.toLowerCase()}` });
                        navigate({ to: "/trips/$tripId/stops/$stopId", params: { tripId, stopId: stop.id } });
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-1.5 text-xs hover:border-primary">
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>

        <button onClick={() => { if (confirm("Slette hele turen?")) { tripsApi.deleteTrip(tripId); navigate({ to: "/trips" }); } }}
          className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
          <Trash2 className="h-4 w-4" /> Slett tur
        </button>
      </section>
    </div>
  );
}

function BigStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </p>
      <p className="mt-1 font-display text-lg md:text-2xl">{value}</p>
    </div>
  );
}
