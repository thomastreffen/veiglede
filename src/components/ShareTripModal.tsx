import { useEffect, useMemo, useState } from "react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Link2, Copy, Check, BookOpen, UserPlus, Globe, Lock,
  Radio, MapPin, Camera, Users, Eye, Trash2, Send,
} from "lucide-react";
import { tripsApi, type Trip } from "@/lib/trips-store";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n/provider";
import {
  createInvite, listInvitesForTrip, deleteInvite, inviteUrl,
  type TripInvite, type InviteRole,
} from "@/lib/trip-invites";
import { flushTripsNow } from "@/lib/cloud-sync";
import { sendTransactionalEmail } from "@/lib/email/send";
import { useLiveOptIn, useLiveSession, isLiveActive } from "@/lib/live-tracking";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(diff / 60000));
  if (m < 60) return `Invitert for ${m} minutt${m === 1 ? "" : "er"} siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Invitert for ${h} time${h === 1 ? "" : "r"} siden`;
  const d = Math.floor(h / 24);
  return `Invitert for ${d} dag${d === 1 ? "" : "er"} siden`;
}

interface Props {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareTripModal({ trip, open, onOpenChange }: Props) {
  const t = useT();
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("viewer");
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [creating, setCreating] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "https://veiglede.no";

  // Generate a share token on first open so the link is always available,
  // and immediately push to Supabase so /shared/{token} resolves right away.
  useEffect(() => {
    if (open && !trip.shareToken) {
      tripsApi.ensureShareToken(trip.id);
      void flushTripsNow();
    }
  }, [open, trip.id, trip.shareToken]);

  const isPublic = trip.isPublic ?? false;
  const shareToken = trip.shareToken ?? "";
  const tripLink = useMemo(
    () => (shareToken ? `${base}/shared/${shareToken}` : ""),
    [base, shareToken],
  );
  const roadbookLink = tripLink ? `${tripLink}?view=roadbook` : "";

  useEffect(() => {
    if (!open || !user) return;
    listInvitesForTrip(trip.id).then(setInvites).catch(() => setInvites([]));
  }, [open, user, trip.id]);

  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const handleCreateInvite = async () => {
    if (!user) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setInviteMsg("Skriv inn en gyldig e-postadresse");
      return;
    }
    if (cleanEmail.toLowerCase() === (user.email ?? "").toLowerCase()) {
      setInviteMsg("Det er deg! Del lenken med andre for å invitere reisefølge.");
      return;
    }
    setInviteMsg(null);
    setCreating(true);
    try {
      const inv = await createInvite(trip.id, cleanEmail, role);
      setInvites((p) => [inv, ...p]);
      setEmail("");
      setRole("viewer");
      const send = await sendTransactionalEmail({
        templateName: "trip-invitation",
        recipientEmail: cleanEmail,
        idempotencyKey: `invite-${inv.id}`,
        templateData: {
          joinUrl: inviteUrl(inv.invite_token),
          tripTitle: trip.title ?? "Veiglede-tur",
          origin: trip.origin,
          destination: trip.destination,
          dateLabel: trip.startDate,
          inviterName: user.email,
          role,
        },
      });
      if (send.ok) {
        setInviteMsg(`✓ Invitasjon sendt til ${cleanEmail}`);
      } else {
        await copy(`inv-${inv.id}`, inviteUrl(inv.invite_token));
        setInviteMsg(`Invitasjonslenke klar — del den manuelt med ${cleanEmail}`);
      }
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : "Kunne ikke lage invitasjon");
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async (inv: TripInvite) => {
    if (!inv.invited_email) return;
    setInviteMsg(null);
    const send = await sendTransactionalEmail({
      templateName: "trip-invitation",
      recipientEmail: inv.invited_email,
      idempotencyKey: `invite-${inv.id}-resend-${Date.now()}`,
      templateData: {
        joinUrl: inviteUrl(inv.invite_token),
        tripTitle: trip.title ?? "Veiglede-tur",
        origin: trip.origin,
        destination: trip.destination,
        dateLabel: trip.startDate,
        inviterName: user?.email,
        role: inv.role,
      },
    });
    if (send.ok) {
      setInviteMsg(`✓ Invitasjon sendt på nytt til ${inv.invited_email}`);
    } else {
      await copy(`inv-${inv.id}`, inviteUrl(inv.invite_token));
      setInviteMsg(`Lenke kopiert — send den manuelt til ${inv.invited_email}`);
    }
  };


  const handleRemove = async (id: string) => {
    try {
      await deleteInvite(id);
      setInvites((p) => p.filter((i) => i.id !== id));
    } catch { /* noop */ }
  };

  const statusLabel = (s: TripInvite["status"]) =>
    s === "invited" ? "Venter på svar"
    : s === "opened" ? "Åpnet lenke"
    : s === "joined" ? "Godtatt ✓"
    : "Avslått";

  const roleLabel = (r: InviteRole) => (r === "editor" ? "Kan redigere" : "Kan se");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg w-full max-h-[90vh] overflow-y-auto overflow-x-hidden bg-surface border-border max-sm:p-4 max-sm:gap-3 [&>*]:max-w-full"
        style={{ maxWidth: "min(32rem, 100vw)" }}
      >
        
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wide">
            Del turen
          </DialogTitle>
          <DialogDescription className="text-sm">
            Del ruta og roadbooken med venner, familie eller reisefølge.
          </DialogDescription>
        </DialogHeader>

        {/* Public toggle */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3.5">
          <span className="h-9 w-9 rounded-lg bg-surface-2 grid place-items-center shrink-0">
            {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-sm">{isPublic ? "Offentlig tur" : "Privat tur"}</p>
              <Switch
                checked={isPublic}
                onCheckedChange={(v) => {
                  if (v && !trip.shareToken) tripsApi.ensureShareToken(trip.id);
                  tripsApi.setTripPublic(trip.id, v);
                  void flushTripsNow();
                }}
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isPublic
                ? "Alle med lenken kan se ruta og roadbooken."
                : "Lenken er deaktivert — kun du kan åpne turen."}
            </p>
          </div>
        </div>

        {/* Share link */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Delingslenke</p>
          <div className="rounded-xl border border-border bg-background/60 p-2 pl-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-mono break-all">{tripLink || "Genererer lenke…"}</span>
            </div>
            <button
              onClick={() => tripLink && copy("trip", tripLink)}
              disabled={!tripLink}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 sm:py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-50 min-h-[44px] sm:min-h-0"
            >
              {copied === "trip" ? <><Check className="h-3.5 w-3.5" /> Kopiert</> : <><Copy className="h-3.5 w-3.5" /> Kopier lenke</>}
            </button>
          </div>
          {roadbookLink && (
            <a
              href={roadbookLink}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm hover:border-primary"
            >
              <BookOpen className="h-4 w-4 text-primary" /> Åpne Roadbook
            </a>
          )}
          {tripLink && (
            <a
              href={tripLink}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-primary hover:border-primary"
            >
              <Eye className="h-4 w-4" /> Forhåndsvis delt versjon
            </a>
          )}
        </div>

        {/* Invite companions (Fellestur v1) */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {t.invite.companions}
          </p>
          {!user ? (
            <p className="text-xs text-muted-foreground">
              {t.invite.loginToJoin}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.invite.modalBody}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Inviter via e-post"
                  className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as InviteRole)}
                  className="rounded-xl border border-border bg-background/60 px-2 py-2.5 text-xs"
                >
                  <option value="viewer">Kan se</option>
                  <option value="editor">Kan redigere</option>
                </select>
                <button
                  onClick={handleCreateInvite}
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {creating ? "Inviterer…" : "Inviter"}
                </button>
              </div>
              {inviteMsg && <p className="text-[11px] text-muted-foreground">{inviteMsg}</p>}

              {invites.length === 0 ? (
                <p className="pt-1 text-xs text-muted-foreground">{t.invite.noInvites}</p>
              ) : (
                <ul className="space-y-1.5 pt-2">
                  {invites.map((inv) => {
                    const url = inviteUrl(inv.invite_token);
                    const pending = inv.status === "invited" || inv.status === "opened";
                    const statusText = pending
                      ? relativeTime(inv.created_at)
                      : statusLabel(inv.status);
                    return (
                      <li key={inv.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2 pl-3 text-xs flex-wrap">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-semibold">{inv.invited_email ?? "Lenkeinvitasjon"}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {statusText}
                          </p>
                        </div>
                        <span
                          className={
                            inv.role === "editor"
                              ? "inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/40"
                              : "inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border"
                          }
                        >
                          {roleLabel(inv.role)}
                        </span>
                        {pending && inv.invited_email && (
                          <button
                            onClick={() => handleResend(inv)}
                            className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-primary"
                          >
                            <Send className="h-3 w-3" /> Send på nytt
                          </button>
                        )}
                        <button
                          onClick={() => copy(`inv-${inv.id}`, url)}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 hover:border-primary"
                          aria-label={t.invite.copy}
                        >
                          {copied === `inv-${inv.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => handleRemove(inv.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 hover:border-destructive text-muted-foreground hover:text-destructive"
                          aria-label={t.invite.remove}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    );
                  })}

                </ul>
              )}
              <p className="pt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {t.invite.liveLater}
              </p>
            </>
          )}
        </div>

        {/* Live sharing toggle */}
        <LiveSharingSection tripId={trip.id} />
      </DialogContent>
    </Dialog>
  );
}


function LiveSharingSection({ tripId }: { tripId: string }) {
  const [liveOn, setLiveOn] = useLiveOptIn(tripId);
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={liveOn}
          onChange={(e) => setLiveOn(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <div className="flex-1">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary font-bold">
            <Radio className={`h-3.5 w-3.5 ${liveOn ? "animate-pulse" : ""}`} /> Del turen live
          </p>
          <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
            La reisefølget følge posisjonen din i sanntid mens du er på veien.
            Slås av som standard — du må selv aktivere deling. Du kan skru det av når som helst.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> Live posisjon</span>
            <span className="inline-flex items-center gap-1.5"><Camera className="h-3 w-3 text-primary" /> Bilder fra ruta</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-primary" /> Siste stopp</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-primary" /> Følgere</span>
          </div>
        </div>
      </label>
    </div>
  );
}

