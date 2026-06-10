import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trackingApi, useTripTracking, statusMeta } from "@/lib/trip-tracking";
import { tripsApi } from "@/lib/trips-store";
import type { Stop } from "@/lib/trips-store";
import { Play, Pause, RotateCcw, Flag, Plus, Check, MapPin, Camera, Clock, Sparkles, Radio, Copy, Share2, ChevronDown, Bug, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useLiveBroadcaster, useLiveOptIn, endLiveSession, isLiveActive, type LiveSession, type LiveBroadcasterDebugState,
} from "@/lib/live-tracking";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

  const { permState, debug: liveDebug, sendTestPositionNow } = useLiveBroadcaster({
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
        pageVisibility={liveDebug.pageVisibility}
        lastVisibilityChangeTime={liveDebug.lastVisibilityChangeTime}
      />

      {user && liveOn && <LiveDebugPanel debug={liveDebug} onSendTestPositionNow={sendTestPositionNow} />}




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

function LiveDebugPanel({
  debug,
  onSendTestPositionNow,
}: {
  debug: LiveBroadcasterDebugState;
  onSendTestPositionNow: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const items = useMemo(() => ([
    { label: "broadcastable", value: boolLabel(debug.broadcastable) },
    { label: "liveOn", value: boolLabel(debug.liveOn) },
    { label: "trip status", value: debug.tripStatus },
    { label: "permission state", value: debug.permissionState },
    { label: "watchPosition started", value: boolLabel(debug.watchStarted) },
    { label: "watchId", value: debug.watchId === null ? "—" : String(debug.watchId) },
    { label: "watchId exists", value: boolLabel(debug.watchIdExists) },
    { label: "GPS fix count", value: String(debug.gpsFixCount) },
    { label: "heartbeat interval active", value: boolLabel(debug.heartbeatIntervalActive) },
    { label: "fallback polling active", value: boolLabel(debug.pollingActive) },
    { label: "last GPS fix time", value: formatTime(debug.lastGpsFixTime) },
    { label: "last GPS fix lat", value: formatCoord(debug.lastGpsFixLat) },
    { label: "last GPS fix lng", value: formatCoord(debug.lastGpsFixLng) },
    { label: "last GPS accuracy", value: formatMeters(debug.lastGpsAccuracy) },
    { label: "previous GPS lat/lng", value: formatLatLngPair(debug.previousGpsLat, debug.previousGpsLng) },
    { label: "distance since previous GPS fix", value: formatKm(debug.distanceSincePreviousGpsKm) },
    { label: "distance since last sent position", value: formatKm(debug.distanceSinceLastSentKm) },
    { label: "movedEnough", value: boolLabel(debug.movedEnough) },
    { label: "canSendImmediate", value: boolLabel(debug.canSendImmediate) },
    { label: "last automatic send source", value: debug.lastSendSource ?? "—" },
    { label: "last automatic send attempt", value: formatTime(debug.lastAutomaticUpsertAttemptTime) },
    { label: "last automatic send success", value: formatTime(debug.lastAutomaticUpsertSuccessTime) },
    { label: "last automatic send error", value: debug.lastAutomaticUpsertError ?? "—" },
    { label: "last heartbeat attempt", value: formatTime(debug.lastHeartbeatUpsertAttemptTime) },
    { label: "last heartbeat upsert success", value: formatTime(debug.lastHeartbeatUpsertSuccessTime) },
    { label: "last heartbeat error", value: debug.lastHeartbeatUpsertError ?? "—" },
    { label: "last manual upsert attempt", value: formatTime(debug.lastManualUpsertAttemptTime) },
    { label: "last manual upsert success", value: formatTime(debug.lastManualUpsertSuccessTime) },
    { label: "last upsert payload lat", value: formatCoord(debug.lastUpsertPayload?.lat ?? null) },
    { label: "last upsert payload lng", value: formatCoord(debug.lastUpsertPayload?.lng ?? null) },
    { label: "last stored row lat/lng", value: formatLatLngPair(debug.lastStoredRow?.lat ?? null, debug.lastStoredRow?.lng ?? null) },
    { label: "last stored row updated_at", value: formatTime(debug.lastStoredRow?.updated_at ?? null) },
    { label: "last upsert error", value: debug.lastUpsertError ?? "—" },
    { label: "page visibility", value: debug.pageVisibility },
    { label: "last visibility change", value: formatTime(debug.lastVisibilityChangeTime) },
    { label: "last resume send", value: formatTime(debug.lastResumeSendTime) },
    { label: "wake lock active", value: boolLabel(debug.wakeLockActive) },
  ]), [debug]);

  async function handleManualSend() {
    try {
      setSending(true);
      const ok = await onSendTestPositionNow();
      if (ok) toast.success("Testposisjon sendt.");
      else toast.error("Kunne ikke sende testposisjon.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-primary/30 bg-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              <Bug className="h-3.5 w-3.5" /> Live debug
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Skjul/vis teknisk status</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualSend}
              disabled={sending}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs font-semibold hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" /> {sending ? "Sender…" : "Send testposisjon nå"}
            </button>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs font-semibold hover:border-primary"
              >
                {open ? "Skjul teknisk status" : "Vis teknisk status"}
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : "rotate-0"}`} />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="border-t border-border/70 px-4 py-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-background/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 break-words text-xs font-medium text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <DebugJsonBlock label="Last upsert payload" value={debug.lastUpsertPayload} />
              <DebugJsonBlock label="Last stored row" value={debug.lastStoredRow} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function DebugJsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-foreground">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}

function boolLabel(value: boolean) {
  return value ? "true" : "false";
}

function formatTime(value: string | null) {
  if (!value) return "—";
  try { return new Date(value).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return value; }
}

function formatCoord(value: number | null) {
  return typeof value === "number" ? value.toFixed(6) : "—";
}

function formatMeters(value: number | null) {
  return typeof value === "number" ? `${Math.round(value)} m` : "—";
}

function formatKm(value: number | null) {
  return typeof value === "number" ? `${(value * 1000).toFixed(1)} m` : "—";
}

function formatLatLngPair(lat: number | null, lng: number | null) {
  if (typeof lat !== "number" || typeof lng !== "number") return "—";
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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

function LiveShareCard({
  user, liveOn, setLiveOn, permDenied, tripStatus, liveActive, liveSession, lastSeenStr,
}: {
  user: { id: string } | null;
  liveOn: boolean;
  setLiveOn: (v: boolean) => void;
  permDenied: boolean;
  tripStatus: "idle" | "active" | "paused" | "completed";
  liveActive: boolean;
  liveSession: LiveSession | null;
  lastSeenStr: string | null;
}) {
  const token = liveSession?.live_share_token ?? null;
  const liveUrl = token ? `https://veiglede.no/live/${token}` : null;

  const helper = !user
    ? "Logg inn for å dele posisjon live."
    : !liveOn
      ? "Del posisjonen din med venner og familie mens du er på tur."
      : permDenied
        ? "Posisjonstilgang blokkert. Aktiver i nettleseren for å dele."
        : "Reisefølget kan se hvor du er. Oppdateres hvert 30. sekund.";

  // Determine state badge
  let badge: { label: string; cls: string; pulse?: boolean } | null = null;
  let showButtons = false;
  let showWaiting = false;

  if (liveOn && user && !permDenied) {
    if (tripStatus === "completed") {
      badge = { label: "Live deling avsluttet", cls: "border-border bg-background/40 text-muted-foreground" };
    } else if (tripStatus === "paused") {
      badge = { label: "Live deling pauset", cls: "border-amber-500/40 bg-amber-500/10 text-amber-400" };
      showButtons = !!liveUrl;
    } else if (liveActive && liveUrl) {
      badge = {
        label: `Live deling aktiv${lastSeenStr ? ` · Sist oppdatert ${lastSeenStr}` : ""}`,
        cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        pulse: true,
      };
      showButtons = true;
    } else {
      showWaiting = true;
    }
  }

  async function copyLink() {
    if (!liveUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(liveUrl);
        toast.success("Live-lenke kopiert!");
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch {
      toast.error("Kunne ikke kopiere lenken.");
    }
  }

  async function invite() {
    if (!liveUrl) return;
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({
          title: "Følg turen min live på Veiglede",
          text: "Jeg deler posisjonen min mens jeg er på tur.",
          url: liveUrl,
        });
        return;
      } catch (err) {
        // User cancellation: no toast
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Fall through to clipboard fallback
      }
    }
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(liveUrl);
        toast.success("Live-lenke kopiert!");
      } else {
        toast.error("Kunne ikke dele lenken.");
      }
    } catch {
      toast.error("Kunne ikke dele lenken.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3 space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={liveOn}
          onChange={(e) => setLiveOn(e.target.checked)}
          disabled={!user}
          className="mt-0.5 h-5 w-5 accent-primary"
        />
        <div className="flex-1 min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Radio className={`h-3.5 w-3.5 ${liveOn ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
            Del posisjon live
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{helper}</p>
        </div>
      </label>

      {showWaiting && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
          Venter på GPS-posisjon…
        </div>
      )}

      {badge && (
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${badge.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.pulse ? "bg-current animate-pulse" : "bg-current/70"}`} />
          {badge.label}
        </div>
      )}

      {showButtons && liveUrl && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold hover:border-primary min-h-[44px]"
          >
            <Copy className="h-4 w-4" /> Kopier live-lenke
          </button>
          <button
            type="button"
            onClick={invite}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 min-h-[44px]"
          >
            <Share2 className="h-4 w-4" /> Inviter reisefølge
          </button>
        </div>
      )}
    </div>
  );
}
