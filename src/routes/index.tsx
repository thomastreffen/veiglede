import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { ArrowRight, Map, BookOpen, Compass } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roadbook — plan your road trip, day by day" },
      { name: "description", content: "A calm, visual companion for planning road trips. Map your route, organize stops by day, write your own roadbook." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-5xl flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-serif text-xl leading-none">r</span>
          <span className="font-serif text-2xl">roadbook</span>
        </div>
        <Link to="/trips" className="text-sm text-muted-foreground hover:text-foreground">Open the app →</Link>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-6 md:pt-16 pb-16">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">A digital roadbook</p>
        <h1 className="mt-4 font-serif text-5xl md:text-7xl leading-[1.02] tracking-tight">
          Plan the road,<br />
          <em className="text-primary not-italic">live the detour.</em>
        </h1>
        <p className="mt-6 max-w-xl text-base md:text-lg text-muted-foreground">
          Roadbook is a calm, visual planner for road trips. Sketch a route, split it into days,
          drop in stops and stories — then bring it with you in your pocket.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/trips" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground hover:bg-primary/90">
            Open my trips <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/trips/new" className="inline-flex items-center gap-2 rounded-full border border-input px-5 py-3 text-sm hover:bg-secondary">
            Start a new road trip
          </Link>
        </div>

        <div className="mt-12">
          <MapPlaceholder height="h-64 md:h-80" labels={["Bergen", "Trondheim"]} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 grid gap-4 md:grid-cols-3">
        {[
          { Icon: Map, title: "Visual route", body: "See your trip on a calm, uncluttered map. No flashing pins, no ads." },
          { Icon: Compass, title: "Day stages", body: "Break long drives into days. Each one with its own stops and notes." },
          { Icon: BookOpen, title: "Roadbook view", body: "A printable, browsable day-by-day diary you take with you." },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-4 font-serif text-2xl">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-5 py-8 text-xs text-muted-foreground flex justify-between">
          <span>© Roadbook</span>
          <span>Made for slow travelers.</span>
        </div>
      </footer>
    </div>
  );
}
