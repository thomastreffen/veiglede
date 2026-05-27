import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Sparkles, Map, BookOpen } from "lucide-react";
import { VeigledeMark } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veiglede — AI-drevet roadtrip-planlegger" },
      { name: "description", content: "Veiglede hjelper deg å planlegge bedre kjøreopplevelser. Velg kjøretøy, kjørestil og rute — få et roadbook tilpasset turen din." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background bg-glow-orange">
      <header className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-4">
        <VeigledeMark />
        <Link to="/trips" className="text-sm text-muted-foreground hover:text-foreground">Start planlegging →</Link>
      </header>

      <section className="mx-auto max-w-5xl px-4 md:px-6 pt-8 md:pt-14 pb-12">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary">
          <span className="inline-block h-px w-8 bg-primary" /> AI-drevet roadtrip-plattform
        </p>
        <h1 className="mt-5 font-display text-balance text-[15vw] sm:text-7xl md:text-8xl leading-[0.92] uppercase">
          Finn veien<br />
          <span className="display-skew text-primary">som betyr noe</span>
        </h1>
        <p className="mt-6 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
          Kjør for opplevelsens skyld. Svingete veier, nasjonale turistveier og stoppene ingen andre finner.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/trips/new" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
            <Plus className="h-4 w-4" strokeWidth={3} /> Start ny tur
          </Link>
          <Link to="/trips" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface/50 px-6 py-3.5 text-sm font-medium hover:bg-surface">
            Utforsk ruter <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <dl className="mt-12 grid grid-cols-4 gap-4 md:gap-8 border-t border-border pt-8">
          {[
            { n: "12", l: "planlagte turer" },
            { n: "4 200", l: "km kjørt totalt" },
            { n: "3", l: "kjøretøy" },
            { n: "47", l: "fotostopp" },
          ].map((s) => (
            <div key={s.l}>
              <dt className="font-display text-3xl md:text-5xl">{s.n}</dt>
              <dd className="mt-1 text-xs text-muted-foreground leading-tight">{s.l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-6 pb-20 grid gap-4 md:grid-cols-3">
        {[
          { Icon: Sparkles, title: "AI ko-pilot", body: "Beskriv turen — få rute, stopp og roadbook tilpasset deg." },
          { Icon: Map, title: "Velg kjørestil", body: "Svingete veier, fototur, nasjonale turistveier eller rolig cruise." },
          { Icon: BookOpen, title: "Roadbook", body: "Dag for dag, stopp for stopp. Klart for å tas med på veien." },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-surface p-6">
            <span className="inline-grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></span>
            <h3 className="mt-4 font-display text-xl uppercase tracking-wide">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-8 text-xs text-muted-foreground flex justify-between">
          <span>© Veiglede</span>
          <span>For de som elsker veien.</span>
        </div>
      </footer>
    </div>
  );
}
