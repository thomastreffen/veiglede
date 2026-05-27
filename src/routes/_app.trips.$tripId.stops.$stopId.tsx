import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useTripsStore, tripsApi, STOP_TYPES, type StopType } from "@/lib/trips-store";
import { ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trips/$tripId/stops/$stopId")({
  head: () => ({ meta: [{ title: "Stopp — Veiglede" }] }),
  component: StopEdit,
});

function StopEdit() {
  const { tripId, stopId } = Route.useParams();
  const { stops } = useTripsStore();
  const navigate = useNavigate();
  const stop = stops.find((s) => s.id === stopId);

  if (!stop) {
    return (
      <div className="py-10">
        <p>Stopp ikke funnet.</p>
        <Link to="/trips/$tripId" params={{ tripId }} className="text-primary underline text-sm">Tilbake</Link>
      </div>
    );
  }

  const input = "w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base outline-none focus:border-primary";

  return (
    <div className="py-4 max-w-2xl">
      <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Til planlegger
      </Link>

      <h1 className="mt-4 font-display text-4xl uppercase">Rediger stopp</h1>

      <div className="mt-6 space-y-5">
        <Field label="Navn">
          <input value={stop.name} onChange={(e) => tripsApi.updateStop(stop.id, { name: e.target.value })} className={input} />
        </Field>

        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {STOP_TYPES.map((t) => (
              <button key={t.value}
                onClick={() => tripsApi.updateStop(stop.id, { type: t.value as StopType })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs transition-colors",
                  stop.type === t.value
                    ? "border-primary bg-primary/15 text-primary font-semibold"
                    : "border-border bg-surface hover:border-foreground/30"
                )}>
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tidspunkt"><input value={stop.estimatedTime ?? ""} placeholder="09:30" onChange={(e) => tripsApi.updateStop(stop.id, { estimatedTime: e.target.value })} className={input} /></Field>
          <Field label="Sted"><input value={stop.location ?? ""} placeholder="Bergen" onChange={(e) => tripsApi.updateStop(stop.id, { location: e.target.value })} className={input} /></Field>
        </div>

        <Field label="Notater">
          <textarea rows={5} value={stop.notes ?? ""} placeholder="Hva er verdt å huske…" onChange={(e) => tripsApi.updateStop(stop.id, { notes: e.target.value })} className={input} />
        </Field>

        <div className="pt-2 flex justify-between gap-3">
          <button onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })} className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">Ferdig</button>
          <button onClick={() => { if (confirm("Slette stoppet?")) { tripsApi.deleteStop(stop.id); navigate({ to: "/trips/$tripId", params: { tripId } }); } }}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
            <Trash2 className="h-4 w-4" /> Slett
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
