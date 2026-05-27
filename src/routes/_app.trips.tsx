import { createFileRoute, Link } from "@tanstack/react-router";
import { useTripsStore } from "@/lib/trips-store";
import { Plus, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/trips")({
  head: () => ({ meta: [{ title: "Your trips — Roadbook" }] }),
  component: TripsDashboard,
});

const COVERS: Record<string, string> = {
  fjord: "from-[oklch(0.78_0.05_220)] to-[oklch(0.55_0.06_240)]",
  tuscan: "from-[oklch(0.82_0.08_60)] to-[oklch(0.55_0.09_45)]",
  sand: "from-[oklch(0.85_0.04_85)] to-[oklch(0.6_0.05_70)]",
};

function TripsDashboard() {
  const { trips, days, stops } = useTripsStore();

  return (
    <div className="py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Your roadbook</p>
          <h1 className="mt-2 font-serif text-4xl md:text-5xl">Trips</h1>
        </div>
        <Link to="/trips/new" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-serif text-2xl">No trips yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Plan your first road trip in under a minute.</p>
          <Link to="/trips/new" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">Start planning</Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {trips.map((t) => {
            const tripDays = days.filter((d) => d.tripId === t.id);
            const tripDayIds = tripDays.map((d) => d.id);
            const stopCount = stops.filter((s) => tripDayIds.includes(s.dayId)).length;
            return (
              <li key={t.id}>
                <Link to="/trips/$tripId" params={{ tripId: t.id }} className="group block rounded-2xl border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow">
                  <div className={`h-32 bg-gradient-to-br ${COVERS[t.cover] ?? COVERS.sand} relative`}>
                    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, white, transparent 60%)" }} />
                  </div>
                  <div className="p-5">
                    <h2 className="font-serif text-2xl leading-tight group-hover:text-primary transition-colors">{t.title}</h2>
                    {t.subtitle && <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>}
                    <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t.origin} → {t.destination}</span>
                      <span>·</span>
                      <span>{tripDays.length} {tripDays.length === 1 ? "day" : "days"}</span>
                      <span>·</span>
                      <span>{stopCount} stops</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
