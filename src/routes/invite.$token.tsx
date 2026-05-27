import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Eye, MapPin, Clock, Route as RouteIcon, UserPlus, LogIn, Check } from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT } from "@/i18n/provider";
import { useAuth } from "@/lib/auth";
import {
  getSharedTrip,
  joinTripWithToken,
  setPendingInvite,
  type SharedTripPayload,
} from "@/lib/trip-invites";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Delt tur — Veiglede" }] }),
  component: InvitePage,
});

interface TripLite {
  id: string;
  title?: string;
  subtitle?: string;
  origin?: string;
  destination?: string;
  distanceKm?: number;
  drivingTime?: string;
}
interface DayLite { id: string; tripId: string; dayNumber: number; title: string; date?: string; summary?: string }
interface StopLite { id: string; dayId: string; name: string; location?: string; estimatedTime?: string; order: number }

function InvitePage() {
  const { token } = Route.useParams();
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SharedTripPayload | null | "loading" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSharedTrip(token)
      .then((p) => { if (!cancelled) setPayload(p); })
      .catch(() => { if (!cancelled) setPayload("error"); });
    return () => { cancelled = true; };
  }, [token]);

  // Auto-join after login if user already signed in with a pending token
  useEffect(() => {
    if (!user || joined) return;
    if (payload === "loading" || payload === "error" || payload === null) return;
    if (payload.invite.status === "joined" && payload.invite.joined_user_id === user.id) {
      setJoined(true);
    }
  }, [user, payload, joined]);

  const handleJoin = async () => {
    if (!user) {
      setPendingInvite(token);
      navigate({ to: "/login" });
      return;
    }
    setJoining(true);
    try {
      await joinTripWithToken(token);
      setJoined(true);
    } catch {
      /* swallow */
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Veiglede"><VeigledeLogo size="md" /></Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
              <Eye className="h-3 w-3" /> {t.invite.sharedTrip}
            </span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {payload === "loading" && (
          <p className="text-sm text-muted-foreground">…</p>
        )}

        {(payload === "error" || payload === null) && (
          <div className="text-center py-16">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="mt-3 font-display text-2xl uppercase">{t.invite.invalidLink}</p>
            <Link to="/" className="mt-5 inline-flex text-sm text-primary underline">
              {t.invite.backHome}
            </Link>
          </div>
        )}

        {payload && typeof payload !== "string" && payload.trip && (
          <SharedView
            payload={payload}
            joined={joined}
            joining={joining}
            isOwner={user?.id === payload.invite.owner_user_id}
            onJoin={handleJoin}
            isLoggedIn={!!user}
          />
        )}

        {payload && typeof payload !== "string" && !payload.trip && (
          <div className="text-center py-16">
            <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="mt-3 font-display text-2xl uppercase">{t.invite.invalidLink}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Eieren har ikke synkronisert turen til skyen enda.
            </p>
            <Link to="/" className="mt-5 inline-flex text-sm text-primary underline">
              {t.invite.backHome}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SharedView({
  payload, joined, joining, isOwner, isLoggedIn, onJoin,
}: {
  payload: SharedTripPayload;
  joined: boolean;
  joining: boolean;
  isOwner: boolean;
  isLoggedIn: boolean;
  onJoin: () => void;
}) {
  const t = useT();
  const trip = payload.trip as TripLite;
  const days = (payload.days as DayLite[])
    .filter((d) => d.tripId === trip.id)
    .sort((a, b) => a.dayNumber - b.dayNumber);
  const stops = payload.stops as StopLite[];

  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t.invite.readOnly}
      </span>

      <section className="mt-4 rounded-3xl border border-border bg-surface p-6">
        <h1 className="font-display text-3xl md:text-4xl uppercase leading-tight">
          {trip.title ?? "Tur"}
        </h1>
        {trip.subtitle && <p className="mt-2 text-sm text-foreground/80">{trip.subtitle}</p>}
        {(trip.origin || trip.destination) && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm">
            <MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <RouteIcon className="h-4 w-4 text-primary" />
            <p className="mt-1.5 font-display text-base uppercase">{trip.distanceKm ?? "—"} km</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <Clock className="h-4 w-4 text-primary" />
            <p className="mt-1.5 font-display text-base uppercase">{trip.drivingTime ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <Eye className="h-4 w-4 text-primary" />
            <p className="mt-1.5 font-display text-base uppercase">{days.length}</p>
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        {isOwner ? (
          <p className="text-sm">{t.invite.ownerOpening}</p>
        ) : joined ? (
          <p className="inline-flex items-center gap-2 text-sm text-primary font-semibold">
            <Check className="h-4 w-4" /> {t.invite.joined}
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onJoin}
              disabled={joining}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" /> {t.invite.joinTrip}
            </button>
            {!isLoggedIn && (
              <Link
                to="/login"
                onClick={() => { /* token already set by onJoin path; here just navigate */ }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm hover:border-primary"
              >
                <LogIn className="h-4 w-4" /> {t.invite.loginToJoin}
              </Link>
            )}
            <span className="self-center text-xs text-muted-foreground">
              {!isLoggedIn && t.invite.continueGuest}
            </span>
          </div>
        )}
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t.invite.liveLater}
        </p>
      </section>

      {/* Days */}
      <section className="mt-6">
        <h2 className="font-display text-2xl uppercase">Dag for dag</h2>
        <ol className="mt-3 space-y-3">
          {days.map((day) => {
            const ds = stops
              .filter((s) => s.dayId === day.id)
              .sort((a, b) => a.order - b.order);
            return (
              <li key={day.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl uppercase text-primary">
                    Dag {day.dayNumber}
                  </span>
                  {day.date && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {day.date}
                    </span>
                  )}
                </div>
                <p className="font-display text-lg uppercase">{day.title}</p>
                {day.summary && (
                  <p className="text-xs text-muted-foreground mt-0.5">{day.summary}</p>
                )}
                <ul className="mt-3 space-y-2">
                  {ds.map((stop) => (
                    <li key={stop.id} className="flex items-start gap-2.5 text-sm">
                      <span className="h-7 w-7 rounded-lg bg-surface-2 grid place-items-center shrink-0">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{stop.name}</p>
                        {stop.location && (
                          <p className="text-[11px] text-muted-foreground">{stop.location}</p>
                        )}
                      </div>
                      {stop.estimatedTime && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {stop.estimatedTime}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
