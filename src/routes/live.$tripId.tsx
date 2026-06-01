import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LiveTripMap } from "@/components/LiveTripMap";

export const Route = createFileRoute("/live/$tripId")({
  head: () => ({ meta: [{ title: "Følg live — Veiglede" }] }),
  component: LiveFollowPage,
});

function LiveFollowPage() {
  const { tripId } = Route.useParams();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <Link to="/trips" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tilbake
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">Følg turen live</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Posisjonen oppdateres automatisk så lenge føreren deler.
        </p>
        <div className="mt-5">
          <LiveTripMap tripId={tripId} height="68vh" />
        </div>
      </main>
    </div>
  );
}
