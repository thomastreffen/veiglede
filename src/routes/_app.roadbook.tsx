import { createFileRoute, Link } from "@tanstack/react-router";
import { useTripsStore, vehicleMeta, styleMeta } from "@/lib/trips-store";
import { BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/roadbook")({
  head: () => ({ meta: [{ title: "Roadbook — Veiglede" }] }),
  component: RoadbookIndex,
});

function RoadbookIndex() {
  const { trips } = useTripsStore();
  return (
    <div className="py-6">
      <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Velg en tur</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase">Roadbook</h1>
      <p className="mt-3 text-muted-foreground max-w-lg">Dag for dag, stopp for stopp. Klart for å tas med på veien.</p>

      <ul className="mt-8 space-y-3">
        {trips.map((t) => {
          const v = vehicleMeta(t.vehicle);
          const s = styleMeta(t.style);
          return (
            <li key={t.id}>
              <Link to="/trips/$tripId/roadbook" params={{ tripId: t.id }} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 md:p-5 hover:border-primary transition-colors">
                <span className="grid place-items-center h-12 w-12 rounded-xl bg-primary/15 text-primary shrink-0"><BookOpen className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg md:text-xl uppercase truncate">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{v.emoji} {v.label} · {s.emoji} {s.label} · {t.distanceKm} km</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
        {trips.length === 0 && <li className="text-sm text-muted-foreground">Ingen turer enda.</li>}
      </ul>
    </div>
  );
}
