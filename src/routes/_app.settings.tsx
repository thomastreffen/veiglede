import { createFileRoute } from "@tanstack/react-router";
import { useDebugMode, setDebugMode } from "@/components/DemoDebugPanel";
import { useTheme, setTheme, type Theme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Profil — Veiglede" }] }),
  component: Settings,
});

function Settings() {
  const debug = useDebugMode();
  const theme = useTheme();
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
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Utseende</p>
        <h2 className="mt-1 font-display text-xl uppercase">Tema</h2>
        <p className="mt-1 text-xs text-muted-foreground">Mørk modus er standard. Bytt til lys for kjøring i dagslys.</p>

        <div className="mt-4 inline-flex rounded-2xl border border-border bg-background p-1">
          <ThemeOption current={theme} value="dark" label="Mørk" icon={<Moon className="h-4 w-4" />} />
          <ThemeOption current={theme} value="light" label="Lys" icon={<Sun className="h-4 w-4" />} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Demo</p>
        <h2 className="mt-1 font-display text-xl uppercase">Utvikler</h2>

        <label className="mt-4 flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-medium">Vis debug-paneler</p>
            <p className="text-xs text-muted-foreground">Skjult i normal demo. Slå på for å se rute- og data-status.</p>
          </div>
          <span
            onClick={() => setDebugMode(!debug)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${debug ? "bg-primary" : "bg-border"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${debug ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        </label>

        <button
          onClick={() => { if (confirm("Tilbakestille demo-data?")) { localStorage.removeItem("veiglede.v2"); localStorage.removeItem("veiglede.v3"); localStorage.removeItem("veiglede.v4"); location.reload(); } }}
          className="mt-5 w-full rounded-2xl border border-border bg-background py-3 text-sm hover:border-primary"
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
