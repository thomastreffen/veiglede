import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Profile — Roadbook" }] }),
  component: Settings,
});

function Settings() {
  return (
    <div className="py-6 max-w-xl">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">You</p>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">Profile</h1>
      <p className="mt-3 text-muted-foreground">Personal settings will live here. For now this is a placeholder for the MVP.</p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center font-serif text-2xl">T</div>
          <div>
            <p className="font-medium">Traveler</p>
            <p className="text-xs text-muted-foreground">Local demo profile</p>
          </div>
        </div>

        <div className="pt-4 border-t border-border/60 space-y-3 text-sm">
          <Row label="Units" value="Kilometers" />
          <Row label="Currency" value="EUR" />
          <Row label="Theme" value="Warm sand" />
        </div>

        <button
          onClick={() => { if (confirm("Reset all demo data?")) { localStorage.removeItem("roadbook.v1"); location.reload(); } }}
          className="mt-4 w-full rounded-full border border-input py-2.5 text-sm hover:bg-secondary"
        >
          Reset demo data
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
