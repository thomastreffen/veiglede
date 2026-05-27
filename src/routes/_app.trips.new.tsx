import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { tripsApi } from "@/lib/trips-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/trips/new")({
  head: () => ({ meta: [{ title: "New trip — Roadbook" }] }),
  component: NewTrip,
});

const COVERS = [
  { id: "sand", label: "Sand", class: "from-[oklch(0.85_0.04_85)] to-[oklch(0.6_0.05_70)]" },
  { id: "fjord", label: "Fjord", class: "from-[oklch(0.78_0.05_220)] to-[oklch(0.55_0.06_240)]" },
  { id: "tuscan", label: "Tuscan", class: "from-[oklch(0.82_0.08_60)] to-[oklch(0.55_0.09_45)]" },
];

function NewTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", subtitle: "", origin: "", destination: "", startDate: "", endDate: "", cover: "sand" });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.origin || !form.destination) return;
    const trip = tripsApi.createTrip(form);
    navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
  };

  return (
    <div className="py-6 max-w-2xl">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">A fresh page</p>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">New road trip</h1>
      <p className="mt-3 text-muted-foreground">Just the basics for now. You can refine the route and stops next.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="title">Trip name</Label>
          <Input id="title" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Norwegian Fjords" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="subtitle">Subtitle</Label>
          <Textarea id="subtitle" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Slow coastal drive through western Norway" className="mt-1.5" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="origin">From</Label>
            <Input id="origin" required value={form.origin} onChange={(e) => set("origin", e.target.value)} placeholder="Bergen" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="destination">To</Label>
            <Input id="destination" required value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Trondheim" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="start">Start</Label>
            <Input id="start" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="end">End</Label>
            <Input id="end" type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label>Cover</Label>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {COVERS.map((c) => (
              <button type="button" key={c.id} onClick={() => set("cover", c.id)} className={`h-20 rounded-xl bg-gradient-to-br ${c.class} ring-2 transition-all ${form.cover === c.id ? "ring-primary" : "ring-transparent"}`}>
                <span className="sr-only">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pt-2 flex gap-3">
          <button type="submit" className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground">Create trip</button>
          <button type="button" onClick={() => navigate({ to: "/trips" })} className="rounded-full border border-input px-6 py-2.5 text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
