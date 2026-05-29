import { useEffect, useMemo, useState } from "react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Link2, Copy, Check, BookOpen, UserPlus, Globe, Lock,
  Radio, MapPin, Camera, Users, Eye, Trash2,
} from "lucide-react";
import { tripsApi, type Trip } from "@/lib/trips-store";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n/provider";
import {
  createInvite, listInvitesForTrip, deleteInvite, inviteUrl,
  type TripInvite,
} from "@/lib/trip-invites";

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
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [creating, setCreating] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "https://veiglede.no";

  // Generate a share token on first open so the link is always available.
  useEffect(() => {
    if (open && !trip.shareToken) tripsApi.ensureShareToken(trip.id);
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
    setCreating(true);
    try {
      const inv = await createInvite(trip.id, email || null);
      setInvites((p) => [inv, ...p]);
      setEmail("");
      await copy(`inv-${inv.id}`, inviteUrl(inv.invite_token));
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteInvite(id);
      setInvites((p) => p.filter((i) => i.id !== id));
    } catch { /* noop */ }
  };

  const statusLabel = (s: TripInvite["status"]) =>
    s === "invited" ? t.invite.statusInvited
    : s === "opened" ? t.invite.statusOpened
    : s === "joined" ? t.invite.statusJoined
    : t.invite.statusRevoked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface border-border">
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
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2 pl-3">
            <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="flex-1 min-w-0 truncate text-xs font-mono">{tripLink || "Genererer lenke…"}</span>
            <button
              onClick={() => tripLink && copy("trip", tripLink)}
              disabled={!tripLink}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-50"
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
              <div className="flex items-center gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.invite.emailOptional}
                  className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleCreateInvite}
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {creating ? t.invite.creating : t.invite.create}
                </button>
              </div>

              {invites.length === 0 ? (
                <p className="pt-1 text-xs text-muted-foreground">{t.invite.noInvites}</p>
              ) : (
                <ul className="space-y-1.5 pt-2">
                  {invites.map((inv) => {
                    const url = inviteUrl(inv.invite_token);
                    return (
                      <li key={inv.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2 pl-3 text-xs">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-mono">{url}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {inv.invited_email ? `${inv.invited_email} · ` : ""}{statusLabel(inv.status)}
                          </p>
                        </div>
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


        {/* Live sharing teaser */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary font-bold">
            <Radio className="h-3.5 w-3.5" /> Kommer: del turen live
          </p>
          <p className="mt-1.5 text-xs text-foreground/80 leading-relaxed">
            Snart kan du dele reisen mens du er på veien — posisjon, siste stopp, neste stopp,
            bilder du tar underveis og små reiseoppdateringer til de som følger deg.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> Live posisjon</span>
            <span className="inline-flex items-center gap-1.5"><Camera className="h-3 w-3 text-primary" /> Bilder fra ruta</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3 w-3 text-primary" /> Neste planlagte stopp</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3 text-primary" /> Følgere & følge</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
