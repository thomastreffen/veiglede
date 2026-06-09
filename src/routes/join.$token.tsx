import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Lock, MapPin, Clock, Route as RouteIcon, Check, X, UserPlus, LogIn, Users,
} from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { useAuth } from "@/lib/auth";
import {
  getInvitePreview, joinTripWithToken, declineInvite, setPendingInvite,
  type InvitePreview,
} from "@/lib/trip-invites";
import { getPublicPlaceLabel } from "@/lib/public-place";

export const Route = createFileRoute("/join/$token")({
  head: () => ({ meta: [{ title: "Bli med på turen — Veiglede" }] }),
  component: JoinPage,
});

interface TripLite {
  id: string;
  title?: string;
  subtitle?: string;
  origin?: string;
  destination?: string;
  distanceKm?: number;
  drivingTime?: string;
  startDate?: string;
  shareToken?: string;
}

function JoinPage() {
  const { token } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<InvitePreview | "loading" | "error" | null>("loading");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"joined" | "declined" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInvitePreview(token)
      .then((p) => { if (!cancelled) setState(p); })
      .catch(() => { if (!cancelled) setState("error"); });
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      setPendingInvite(token);
      navigate({ to: "/login" });
      return;
    }
    setBusy(true);
    try {
      await joinTripWithToken(token);
      setOutcome("joined");
      toast.success("Du er nå med på turen! 🎉");
      const trip = state && typeof state === "object" ? (state.trip as TripLite | null) : null;
      const tripId = trip?.id;
      if (tripId) {
        setTimeout(() => navigate({ to: "/trips/$tripId", params: { tripId } }), 700);
      } else if (trip?.shareToken) {
        setTimeout(() => navigate({ to: "/shared/$shareToken", params: { shareToken: trip.shareToken! } }), 700);
      }
    } catch {
      /* swallow */
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!user) {
      setPendingInvite(token);
      navigate({ to: "/login" });
      return;
    }
    setBusy(true);
    try {
      await declineInvite(token);
      setOutcome("declined");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Veiglede"><VeigledeLogo size="md" /></Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Users className="h-3 w-3" /> Invitasjon
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {state === "loading" && <p className="text-sm text-muted-foreground">Laster invitasjonen…</p>}

        {(state === "error" || state === null) && (
          <Empty title="Denne invitasjonen er ikke lenger gyldig" />
        )}

        {state && typeof state === "object" && (
          <Valid
            preview={state}
            outcome={outcome}
            busy={busy}
            isLoggedIn={!!user}
            onJoin={handleJoin}
            onDecline={handleDecline}
          />
        )}
      </div>
    </div>
  );
}

function Valid({
  preview, outcome, busy, isLoggedIn, onJoin, onDecline,
}: {
  preview: InvitePreview;
  outcome: "joined" | "declined" | null;
  busy: boolean;
  isLoggedIn: boolean;
  onJoin: () => void;
  onDecline: () => void;
}) {
  const trip = preview.trip as TripLite | null;
  const invite = preview.invite;

  if (!trip) {
    return <Empty title="Turen er ikke synkronisert enda" body="Be eieren åpne turen igjen for å laste opp en kopi." />;
  }
  if (invite.status === "revoked") {
    return <Empty title="Invitasjonen er trukket tilbake" />;
  }

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {preview.owner_name ?? "En reisende"} inviterer deg
      </p>
      <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase leading-tight">
        {trip.title ?? "Tur"}
      </h1>
      {trip.subtitle && <p className="mt-2 text-sm text-foreground/80">{trip.subtitle}</p>}

      <section className="mt-4 rounded-3xl border border-border bg-surface p-5">
        {(trip.origin || trip.destination) && (
          <p className="inline-flex items-center gap-1.5 text-sm">
            <MapPin className="h-4 w-4 text-primary" /> {getPublicPlaceLabel(trip.origin, "Startområde")} → {getPublicPlaceLabel(trip.destination, "Målområde")}
          </p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Stat icon={<RouteIcon className="h-4 w-4" />} value={`${trip.distanceKm ?? "—"} km`} />
          <Stat icon={<Clock className="h-4 w-4" />} value={trip.drivingTime ?? "—"} />
          <Stat icon={<Users className="h-4 w-4" />} value={invite.role === "editor" ? "Kan redigere" : "Kan se"} />
        </div>
        {trip.startDate && (
          <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Starter {trip.startDate}
          </p>
        )}
      </section>

      {outcome === "joined" ? (
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-primary font-semibold">
          <Check className="h-4 w-4" /> Du er med på turen — sender deg videre…
        </p>
      ) : outcome === "declined" ? (
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <X className="h-4 w-4" /> Invitasjon avslått
        </p>
      ) : (
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button
            onClick={onJoin}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {isLoggedIn ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {isLoggedIn ? "Bli med på turen" : "Logg inn for å bli med"}
          </button>
          <button
            onClick={onDecline}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm hover:border-destructive hover:text-destructive disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Avslå
          </button>
        </div>
      )}
    </>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <span className="text-primary">{icon}</span>
      <p className="mt-1.5 font-display text-base uppercase">{value}</p>
    </div>
  );
}

function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center py-16">
      <Lock className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="mt-3 font-display text-2xl uppercase">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      <Link to="/" className="mt-5 inline-flex text-sm text-primary underline">Tilbake til Veiglede</Link>
    </div>
  );
}
