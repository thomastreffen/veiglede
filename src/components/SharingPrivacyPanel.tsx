import { Globe, Lock, Radio, Share2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { tripsApi, type Trip } from "@/lib/trips-store";
import { flushTripsNow } from "@/lib/cloud-sync";
import {
  useLiveOptIn, useLiveSession, isLiveActive, endLiveSession,
} from "@/lib/live-tracking";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  trip: Trip;
  onOpenShare: () => void;
}

/**
 * Owner-side "Deling og personvern" panel.
 *
 * One place that answers: Is my trip plan shared? Is live position shared?
 * Who can see what? How do I stop sharing?
 *
 * Display-only — does not change live or trip sharing backend. It reads the
 * same state the rest of the app uses (trip.isPublic + live session/opt-in)
 * and calls the existing setTripPublic / endLiveSession actions.
 */
export function SharingPrivacyPanel({ trip, onOpenShare }: Props) {
  const { user } = useAuth();
  const isPublic = trip.isPublic ?? false;
  const [liveOn, setLiveOn] = useLiveOptIn(trip.id);
  const session = useLiveSession(trip.id);
  const liveActive = isLiveActive(session);
  const anyActive = isPublic || liveActive || liveOn;

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

  return (
    <section
      aria-labelledby="sharing-privacy-heading"
      className="mb-4 rounded-2xl border border-border bg-surface p-4 space-y-3"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 id="sharing-privacy-heading" className="font-display text-base uppercase tracking-wide">
            Deling og personvern
          </h2>
        </div>
        {anyActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Eye className="h-3 w-3" /> Deling er aktiv
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <EyeOff className="h-3 w-3" /> Ingen deling aktiv
          </span>
        )}
      </header>

      {/* A. Turplan */}
      <div className="rounded-xl border border-border bg-background/40 p-3.5">
        <div className="flex items-start gap-3">
          <span className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center shrink-0">
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-foreground" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Turplan</p>
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
                : "Bare du kan se denne turplanen."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenShare}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 min-h-[40px]"
          >
            <Share2 className="h-3.5 w-3.5" />
            {isPublic ? "Administrer turdeling" : "Del turplan"}
          </button>
          {isPublic && (
            <button
              type="button"
              onClick={handleDisableTripShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-destructive hover:text-destructive min-h-[40px]"
            >
              <Lock className="h-3.5 w-3.5" />
              Slå av deling
            </button>
          )}
        </div>
      </div>

      {/* B. Live-posisjon */}
      <div className="rounded-xl border border-border bg-background/40 p-3.5">
        <div className="flex items-start gap-3">
          <span className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center shrink-0">
            <Radio className={`h-4 w-4 ${liveActive ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </span>
          <div className="flex-1 min-w-0">
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
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenShare}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 min-h-[40px]"
          >
            <Radio className="h-3.5 w-3.5" />
            Administrer live-deling
          </button>
          {(liveActive || liveOn) && (
            <button
              type="button"
              onClick={handleStopLive}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-destructive hover:text-destructive min-h-[40px]"
            >
              <Lock className="h-3.5 w-3.5" />
              Stopp live-deling
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Turdeling og live-deling er to forskjellige ting. Turdeling viser ruta og roadbooken — aldri live-posisjon.
        Live-deling viser hvor du er akkurat nå — den deler ikke automatisk redigering eller kontoopplysninger.
      </p>
    </section>
  );
}
