import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useTripsStore, tripsApi, STOP_TYPES, type StopType } from "@/lib/trips-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId/stops/$stopId")({
  head: () => ({ meta: [{ title: "Stop — Roadbook" }] }),
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
        <p>Stop not found.</p>
        <Link to="/trips/$tripId" params={{ tripId }} className="text-primary underline text-sm">Back</Link>
      </div>
    );
  }

  return (
    <div className="py-4 max-w-2xl">
      <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to planner
      </Link>

      <h1 className="mt-4 font-serif text-4xl">Edit stop</h1>

      <div className="mt-6 space-y-5">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={stop.name} onChange={(e) => tripsApi.updateStop(stop.id, { name: e.target.value })} className="mt-1.5" />
        </div>

        <div>
          <Label>Type</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STOP_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => tripsApi.updateStop(stop.id, { type: t.value as StopType })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${stop.type === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground/30"}`}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="time">Estimated time</Label>
            <Input id="time" value={stop.estimatedTime ?? ""} placeholder="09:30 or 1h" onChange={(e) => tripsApi.updateStop(stop.id, { estimatedTime: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="loc">Location</Label>
            <Input id="loc" value={stop.location ?? ""} placeholder="Bergen" onChange={(e) => tripsApi.updateStop(stop.id, { location: e.target.value })} className="mt-1.5" />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={5} value={stop.notes ?? ""} placeholder="Anything worth remembering…" onChange={(e) => tripsApi.updateStop(stop.id, { notes: e.target.value })} className="mt-1.5" />
        </div>

        <div className="pt-2 flex justify-between">
          <button onClick={() => navigate({ to: "/trips/$tripId", params: { tripId } })} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground">Done</button>
          <button onClick={() => { if (confirm("Delete this stop?")) { tripsApi.deleteStop(stop.id); navigate({ to: "/trips/$tripId", params: { tripId } }); } }} className="inline-flex items-center gap-1.5 rounded-full border border-input px-4 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
