import { useState } from "react";
import { Globe, Lock, Radio, Share2, ShieldCheck, Eye, EyeOff, Play, Pause, Flag, RotateCcw, Copy, Check, UserPlus } from "lucide-react";
import { tripsApi, type Trip } from "@/lib/trips-store";
import { flushTripsNow } from "@/lib/cloud-sync";
import {
  useLiveOptIn, useLiveSession, isLiveActive, endLiveSession,
} from "@/lib/live-tracking";
import { useTripTracking, trackingApi, statusMeta } from "@/lib/trip-tracking";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  trip: Trip;
  onOpenShare: () => void;
}

/**
 * Top "Turkontroll" panel.
 *
 * Surfaces three owner essentials immediately:
 *   1. Turstatus — start/pause/fullfør
 *   2. Turplan-deling — privat / delt med lenke
 *   3. Live-posisjon — av / på + quick actions when live
 *
 * Display-only — does not change live or trip sharing backend. It reads the
 * same state the rest of the app uses (trip.isPublic + live session/opt-in +
 * trip-tracking status) and calls the existing setTripPublic, trackingApi,
 * and endLiveSession actions.
 */
export function SharingPrivacyPanel({ trip, onOpenShare }: Props) {
  const { user } = useAuth();
  const tracking = useTripTracking(trip.id);
  const statusM = statusMeta(tracking.status);

  const isPublic = trip.isPublic ?? false;
  const [liveOn, setLiveOn] = useLiveOptIn(trip.id);
  const session = useLiveSession(trip.id);
  const liveActive = isLiveActive(session);
  const anyShareActive = isPublic || liveActive || liveOn;

  const base = typeof window !== "undefined" ? window.location.origin : "https://veiglede.no";
  const liveUrl = session?.live_share_token ? `${base}/live/${session.live_share_token}` : "";
  const lastSeenStr = session?.updated_at
    ? new Date(session.updated_at).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
    : null;

  const [copied, setCopied] = useState(false);

  const handleDisableTripShare = () => {
    if (!window.confirm("Når du slår av deling, vil lenken ikke lenger fungere. Vil du fortsette?")) return;
    tripsApi.setTripPublic(trip.id, false);
    void flushTripsNow();
    toast.success("Turplanen er nå privat");
  };

  const handleStopLive = async () => {
    if (!window.confirm("Når du stopper live-deling, kan ingen følge posisjonen din videre. Vil du fortsette?")) return;
    setLiveOn(false);
    try {
      if (user?.id) await endLiveSession({ tripId: trip.id, userId: user.id });
    } catch { /* noop */ }
    toast.success("Live-deling er stoppet");
  };

  const handleStartLive = () => {
    setLiveOn(true);
    toast.success("Live-deling er på");
  };

  const handleCopyLive = async () => {
    if (!liveUrl) return;
    try { await navigator.clipboard.writeText(liveUrl); } catch { /* noop */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section
      aria-labelledby="trip-control-heading"
      className="mb-4 rounded-2xl border border-border bg-surface p-4 space-y-3"
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <h2 id="trip-control-heading" className="truncate font-display text-base uppercase tracking-wide">
            Turkontroll
          </h2>
        </div>
        {anyShareActive ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Eye className="h-3 w-3" /> Deling er aktiv
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <EyeOff className="h-3 w-3" /> Ingen deling aktiv
          </span>
        )}
      </header>

      {/* 1. Turstatus */}
      <div className="rounded-xl border border-border bg-background/40 p-3.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Turstatus</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              <span className="mr-1">{statusM.emoji}</span>{statusM.label}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusM.cls}`}>
            {statusM.label}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tracking.status === "idle" && (
            <StatusBtn onClick={() => trackingApi.start(trip.id)} primary><Play className="h-3.5 w-3.5" /> Start tur</StatusBtn>
          )}
          {tracking.status === "active" && (
            <>
              <StatusBtn onClick={() => trackingApi.pause(trip.id)}><Pause className="h-3.5 w-3.5" /> Pause</StatusBtn>
              <StatusBtn onClick={() => trackingApi.complete(trip.id)} primary><Flag className="h-3.5 w-3.5" /> Fullfør</StatusBtn>
            </>
          )}
          {tracking.status === "paused" && (
            <>
              <StatusBtn onClick={() => trackingApi.resume(trip.id)} primary><Play className="h-3.5 w-3.5" /> Fortsett</StatusBtn>
              <StatusBtn onClick={() => trackingApi.complete(trip.id)}><Flag className="h-3.5 w-3.5" /> Fullfør</StatusBtn>
            </>
          )}
          {tracking.status === "completed" && (
            <StatusBtn onClick={() => trackingApi.reset(trip.id)}><RotateCcw className="h-3.5 w-3.5" /> Nullstill</StatusBtn>
          )}
        </div>
      </div>

      {/* 2. Turplan-deling */}
      <div className="rounded-xl border border-border bg-background/40 p-3.5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2">
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-foreground" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Turplan-deling</p>
              <span
                className={
                  isPublic
                    ? "inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/40"
                    : "inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border"
                }
              >
                {isPublic ? "Delt med lenke" : "Privat"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {isPublic
                ? "Alle med lenken kan se turplanen, men ikke live-posisjonen din."
                : "Bare du kan se turplanen."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenShare}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
          >
            <Share2 className="h-3.5 w-3.5" />
            {isPublic ? "Administrer deling" : "Del turplan"}
          </button>
          {isPublic && (
            <button
              type="button"
              onClick={handleDisableTripShare}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-destructive hover:text-destructive"
            >
              <Lock className="h-3.5 w-3.5" /> Slå av deling
            </button>
          )}
        </div>
      </div>

      {/* 3. Live-posisjon */}
      <div className="rounded-xl border border-border bg-background/40 p-3.5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2">
            <Radio className={`h-4 w-4 ${liveActive ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live-posisjon</p>
              <span
                className={
                  liveActive
                    ? "inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/40"
                    : "inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border"
                }
              >
                {liveActive ? "På" : liveOn ? "Venter" : "Av"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {liveActive
                ? "Alle med live-lenken kan følge posisjonen din mens delingen er aktiv."
                : liveOn
                  ? "Live-deling er på, men ingen posisjon er sendt enda. Start turen for å begynne å sende posisjon."
                  : "Live-posisjonen din deles ikke."}
            </p>
            {liveActive && lastSeenStr && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-primary font-semibold">
                <Radio className="h-3 w-3 animate-pulse" />
                Live deling aktiv · Sist oppdatert {lastSeenStr}
              </p>
            )}
          </div>
        </div>

        {/* Active live: quick actions */}
        {liveActive && liveUrl && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyLive}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
            >
              {copied ? <><Check className="h-3.5 w-3.5" /> Kopiert</> : <><Copy className="h-3.5 w-3.5" /> Kopier live-lenke</>}
            </button>
            <button
              type="button"
              onClick={onOpenShare}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary"
            >
              <UserPlus className="h-3.5 w-3.5" /> Inviter reisefølge
            </button>
            <button
              type="button"
              onClick={handleStopLive}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-destructive hover:text-destructive"
            >
              <Lock className="h-3.5 w-3.5" /> Stopp live-deling
            </button>
          </div>
        )}

        {/* Not active */}
        {!liveActive && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!liveOn ? (
              <button
                type="button"
                onClick={handleStartLive}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
              >
                <Radio className="h-3.5 w-3.5" /> Del live-posisjon
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopLive}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-destructive hover:text-destructive"
              >
                <Lock className="h-3.5 w-3.5" /> Slå av live-deling
              </button>
            )}
            <button
              type="button"
              onClick={onOpenShare}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary"
            >
              <Share2 className="h-3.5 w-3.5" /> Administrer live-deling
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Du bestemmer selv hva som deles. Turplan og live-posisjon styres hver for seg.
      </p>
    </section>
  );
}

function StatusBtn({
  onClick, primary, children,
}: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
          : "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary"
      }
    >
      {children}
    </button>
  );
}
