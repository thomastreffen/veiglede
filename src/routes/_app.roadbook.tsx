import { createFileRoute, Link } from "@tanstack/react-router";
import { useTripsStore } from "@/lib/trips-store";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_app/roadbook")({
  head: () => ({ meta: [{ title: "Roadbook — Roadbook" }] }),
  component: RoadbookIndex,
});

function RoadbookIndex() {
  const { trips } = useTripsStore();
  return (
    <div className="py-6">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Pick a trip</p>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">Roadbook</h1>
      <p className="mt-3 text-muted-foreground max-w-lg">The day-by-day view of any trip. Calm, printable, easy to read on the road.</p>

      <ul className="mt-8 space-y-3">
        {trips.map((t) => (
          <li key={t.id}>
            <Link to="/trips/$tripId/roadbook" params={{ tripId: t.id }} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary transition-colors">
              <BookOpen className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xl">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.origin} → {t.destination}</p>
              </div>
              <span className="text-sm text-muted-foreground">Read →</span>
            </Link>
          </li>
        ))}
        {trips.length === 0 && <li className="text-sm text-muted-foreground">No trips yet.</li>}
      </ul>
    </div>
  );
}
