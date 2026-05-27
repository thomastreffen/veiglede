import { createFileRoute } from "@tanstack/react-router";
import { DemoDebugPanel } from "@/components/DemoDebugPanel";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Profil — Veiglede" }] }),
  component: Settings,
});

function Settings() {
  return (
    <div className="py-6 max-w-xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Du</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase">Profil</h1>
      <p className="mt-3 text-muted-foreground">Personlige innstillinger kommer her. Foreløpig en plassholder i MVP.</p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-2xl">T</div>
          <div>
            <p className="font-semibold">Sjåfør</p>
            <p className="text-xs text-muted-foreground">Lokal demo-profil</p>
          </div>
        </div>

        <div className="pt-4 border-t border-border space-y-3 text-sm">
          <Row label="Enheter" value="Kilometer" />
          <Row label="Standardkjøretøy" value="Motorsykkel" />
          <Row label="Tema" value="Mørk" />
        </div>

        <DemoDebugPanel
          title="Demo"
          items={[
            { label: "Storage key", value: "veiglede.v4" },
            { label: "Reset", value: "Sletter lokale demo-turer" },
          ]}
        />

        <button
          onClick={() => { if (confirm("Tilbakestille demo-data?")) { localStorage.removeItem("veiglede.v2"); localStorage.removeItem("veiglede.v3"); localStorage.removeItem("veiglede.v4"); location.reload(); } }}
          className="mt-4 w-full rounded-2xl border border-border bg-background py-3 text-sm hover:border-primary"
        >
          Tilbakestill demo-data
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
