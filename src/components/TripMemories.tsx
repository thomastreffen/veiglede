import { useTripTracking } from "@/lib/trip-tracking";
import type { Stop, Trip } from "@/lib/trips-store";
import { stopMeta, getPhotoMemories } from "@/lib/trips-store";
import { Camera, Share2, Award, MapPin, Sparkles } from "lucide-react";

export function TripMemories({
  trip, tripStops, onShare,
}: { trip: Trip; tripStops: Stop[]; onShare: () => void }) {
  const t = useTripTracking(trip.id);
  if (t.status !== "completed") return null;

  const visited = tripStops.filter((s) => t.visitedStopIds.includes(s.id));
  const memories = getPhotoMemories(trip, visited.length ? visited : tripStops);
  const duration = t.startedAt && t.completedAt
    ? `${Math.floor((t.completedAt - t.startedAt) / 3_600_000)}t ${Math.floor(((t.completedAt - t.startedAt) % 3_600_000) / 60_000)}min`
    : trip.drivingTime;

  return (
    <section id="memories" className="mt-10 scroll-mt-24 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-primary/5 p-5 md:p-7">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-500 inline-flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" /> Turminner
          </p>
          <h2 className="mt-1 font-display text-3xl uppercase">Turen er ferdig</h2>
          <p className="mt-1 text-sm text-muted-foreground">{trip.origin} → {trip.destination} · {duration}</p>
        </div>
        <button onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          <Share2 className="h-4 w-4" /> Del turminne
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <SumStat label="Distanse" value={`${trip.distanceKm} km`} />
        <SumStat label="Besøkt" value={`${visited.length}/${tripStops.length}`} />
        <SumStat label="Spontant" value={String(t.spontaneousStops.length)} />
      </div>

      {visited.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Du besøkte</p>
          <ul className="space-y-1.5">
            {visited.map((s) => {
              const m = stopMeta(s.type);
              return (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
                  <span className="text-base">{m.emoji}</span>
                  <span className="text-sm font-medium truncate flex-1">{s.name}</span>
                  {s.location && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.location}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {t.spontaneousStops.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Spontane stopp</p>
          <ul className="flex flex-wrap gap-1.5">
            {t.spontaneousStops.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 text-xs">
                <Sparkles className="h-3 w-3" /> {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
          <Camera className="h-3 w-3" /> Bilder fra turen
        </p>
        <div className="grid grid-cols-3 gap-2">
          {memories.map((m) => (
            <div key={m.id} className="aspect-square rounded-xl border border-border bg-gradient-to-br from-surface to-surface-2 grid place-items-center relative overflow-hidden">
              <span className="text-3xl">{m.emoji}</span>
              <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-background/90 to-transparent">
                <p className="text-[9px] uppercase tracking-wider truncate">{m.caption}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground italic">Senere kobles bildene dine automatisk hit basert på tid og posisjon.</p>
      </div>
    </section>
  );
}

function SumStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-lg">{value}</p>
    </div>
  );
}
