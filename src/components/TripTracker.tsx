import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trackingApi, useTripTracking, statusMeta } from "@/lib/trip-tracking";
import { tripsApi } from "@/lib/trips-store";
import type { Stop } from "@/lib/trips-store";
import { Play, Pause, RotateCcw, Flag, Plus, Check, MapPin, Camera, Clock, Sparkles, Radio, Copy, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useLiveBroadcaster, useLiveOptIn, endLiveSession, isLiveActive, type LiveSession,
} from "@/lib/live-tracking";

export function TripTracker({
  tripId, tripStops, vehicleLabel, liveSession,
}: { tripId: string; tripStops: Stop[]; vehicleLabel: string; liveSession?: LiveSession | null }) {
  const t = useTripTracking(tripId);
  const meta = statusMeta(t.status);
  const { user } = useAuth();
  const [spontInput, setSpontInput] = useState("");
  const [liveOn, setLiveOn] = useLiveOptIn(tripId);
  const visitedCount = t.visitedStopIds.length;

  const lastVisited = t.visitedStopIds.length
    ? tripStops.find((s) => s.id === t.visitedStopIds[t.visitedStopIds.length - 1])?.name ?? null
    : null;

  const { permState } = useLiveBroadcaster({
    tripId,
    userId: user?.id ?? null,
    enabled: liveOn,
    status: t.status as "idle" | "active" | "paused" | "completed",
    lastStopName: lastVisited,
  });

  const ownLive = liveOn ? (liveSession ?? null) : null;
  const liveActive = isLiveActive(ownLive);
  const lastSeenStr = ownLive?.updated_at
    ? new Date(ownLive.updated_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Clean up live session when trip is completed/reset or toggle is turned off.
  useEffect(() => {
    if (!user?.id) return;
    if (t.status === "completed" || t.status === "idle") {
      if (liveOn) void endLiveSession({ tripId, userId: user.id });
    }
  }, [t.status, liveOn, tripId, user?.id]);

  // Persist actualDistanceKm to the trip once on completion.
  const persistedRef = useRef(false);
  useEffect(() => {
    if (t.status !== "completed") {
      persistedRef.current = false;
      return;
    }
    if (persistedRef.current) return;
    persistedRef.current = true;
    const km = t.actualDistanceKm ?? 0;
    if (km > 0) {
      tripsApi.updateTrip(tripId, { actualDistanceKm: Math.round(km * 10) / 10 });
    }
  }, [t.status, t.actualDistanceKm, tripId]);

  const elapsed = t.startedAt
    ? Math.max(0, (t.completedAt ?? Date.now()) - t.startedAt)
    : 0;
  const elapsedStr = elapsed > 0
    ? `${Math.floor(elapsed / 3_600_000)}t ${Math.floor((elapsed % 3_600_000) / 60_000)}min`
    : "—";

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Tur-sporing</p>
          <h2 className="mt-1 font-display text-2xl uppercase">Live tur</h2>
          <p className="mt-1 text-xs text-muted-foreground">Aktivt kjøretøy: <span className="text-foreground font-medium">{vehicleLabel}</span></p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>
          <span>{meta.emoji}</span> {meta.label}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {t.status === "idle" && (
          <Action onClick={() => trackingApi.start(tripId)} primary>
            <Play className="h-4 w-4" /> Start tur
          </Action>
        )}
        {t.status === "active" && (
          <>
            <Action onClick={() => trackingApi.pause(tripId)}>
              <Pause className="h-4 w-4" /> Pause
            </Action>
            <Action onClick={() => trackingApi.complete(tripId)} primary>
              <Flag className="h-4 w-4" /> Fullfør
            </Action>
          </>
        )}
        {t.status === "paused" && (
          <>
            <Action onClick={() => trackingApi.resume(tripId)} primary>
              <Play className="h-4 w-4" /> Fortsett
            </Action>
            <Action onClick={() => trackingApi.complete(tripId)}>
              <Flag className="h-4 w-4" /> Fullfør
            </Action>
          </>
        )}
        {t.status === "completed" && (
          <Action onClick={() => trackingApi.reset(tripId)}>
            <RotateCcw className="h-4 w-4" /> Nullstill
          </Action>
        )}
      </div>

      {/* Live position sharing toggle */}
      <LiveShareCard
        user={user}
        liveOn={liveOn}
        setLiveOn={setLiveOn}
        permDenied={permState === "denied"}
        tripStatus={t.status}
        liveActive={liveActive}
        liveSession={ownLive}
        lastSeenStr={lastSeenStr}
      />




      {/* Live stats */}
      {t.status !== "idle" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat icon={<Clock className="h-3 w-3" />} label="Tid" value={elapsedStr} />
          <Stat icon={<MapPin className="h-3 w-3" />} label="Besøkt" value={`${visitedCount}/${tripStops.length}`} />
          <Stat icon={<Plus className="h-3 w-3" />} label="Spontant" value={String(t.spontaneousStops.length)} />
          <Stat
            icon={<Radio className="h-3 w-3" />}
            label="Kjørt"
            value={t.actualDistanceKm ? `${Math.round(t.actualDistanceKm)} km` : "—"}
          />
        </div>
      )}

      {/* Check off stops while active/paused */}
      {(t.status === "active" || t.status === "paused") && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Hak av stopp du har besøkt</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {tripStops.map((s) => {
              const on = t.visitedStopIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => trackingApi.toggleVisited(tripId, s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {on ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-current" />}
                  <span className="truncate max-w-[140px]">{s.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={spontInput}
              onChange={(e) => setSpontInput(e.target.value)}
              placeholder="F.eks: Uventet fotostopp"
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/60"
            />
            <button
              onClick={() => { if (spontInput.trim()) { trackingApi.addSpontaneous(tripId, spontInput.trim()); setSpontInput(""); } }}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs uppercase tracking-wider hover:border-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Spontant
            </button>
          </div>
          {t.spontaneousStops.length > 0 && (
            <ul className="mt-2 space-y-1">
              {t.spontaneousStops.map((s) => (
                <li key={s.id} className="text-xs text-foreground/80 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Idle teaser */}
      {t.status === "idle" && (
        <div className="rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-primary font-semibold uppercase tracking-wider text-[10px]">
            <Sparkles className="h-3 w-3" /> Når du starter turen
          </p>
          <p>· Faktisk start- og sluttid logges automatisk</p>
          <p>· Besøkte stopp markeres som du kjører</p>
          <p>· Spontane stopp kan legges til underveis</p>
          <p className="inline-flex items-center gap-1.5"><Camera className="h-3 w-3" /> Senere: bilder kobles til riktig stopp basert på tid og posisjon</p>
          <p>· Senere: hvis du stopper et nytt sted, foreslår Veiglede å legge det til</p>
        </div>
      )}
    </section>
  );
}

function Action({ onClick, primary, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${primary ? "bg-primary text-primary-foreground hover:brightness-110" : "border border-border bg-surface-2 hover:border-primary"}`}>
      {children}
    </button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">{icon} {label}</p>
      <p className="mt-0.5 font-display text-base">{value}</p>
    </div>
  );
}
