// Inline Reisefølge section for planner & roadbook (Fellestur v1).
// Read/manage existing invites; full creation flow lives in ShareTripModal.
import { useEffect, useState } from "react";
import { Users, Copy, Check, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/i18n/provider";
import {
  listInvitesForTrip, deleteInvite, inviteUrl, type TripInvite,
} from "@/lib/trip-invites";

interface Props {
  tripId: string;
  onInvite?: () => void;
}

export function TripCompanions({ tripId, onInvite }: Props) {
  const t = useT();
  const { user } = useAuth();
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listInvitesForTrip(tripId).then(setInvites).catch(() => setInvites([]));
  }, [user, tripId]);

  if (!user) return null;

  const statusLabel = (s: TripInvite["status"]) =>
    s === "invited" ? t.invite.statusInvited
    : s === "opened" ? t.invite.statusOpened
    : s === "joined" ? t.invite.statusJoined
    : t.invite.statusRevoked;

  const copy = async (id: string, url: string) => {
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const remove = async (id: string) => {
    try {
      await deleteInvite(id);
      setInvites((p) => p.filter((i) => i.id !== id));
    } catch { /* noop */ }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-4">
      <header className="flex items-center justify-between gap-3 mb-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Users className="h-4 w-4 text-primary" /> {t.invite.companions}
        </h3>
        {onInvite && (
          <button
            onClick={onInvite}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
          >
            <UserPlus className="h-3.5 w-3.5" /> {t.invite.inviteCompanions}
          </button>
        )}
      </header>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2 pl-3">
          <span className="h-6 w-6 rounded-full bg-primary/15 grid place-items-center text-[10px] font-bold text-primary">
            {(user.email?.[0] ?? "?").toUpperCase()}
          </span>
          <span className="flex-1 truncate">{user.email}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t.invite.owner}
          </span>
        </div>

        {invites.length === 0 ? (
          <p className="pt-1 text-muted-foreground">{t.invite.noInvites}</p>
        ) : (
          invites.map((inv) => {
            const url = inviteUrl(inv.invite_token);
            return (
              <div key={inv.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2 pl-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate font-mono text-[11px]">{url}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {inv.invited_email ? `${inv.invited_email} · ` : ""}{statusLabel(inv.status)}
                  </p>
                </div>
                <button
                  onClick={() => copy(inv.id, url)}
                  className="inline-flex items-center rounded-lg bg-surface-2 px-2 py-1 hover:border-primary"
                  aria-label={t.invite.copy}
                >
                  {copied === inv.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => remove(inv.id)}
                  className="inline-flex items-center rounded-lg bg-surface-2 px-2 py-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                  aria-label={t.invite.remove}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t.invite.liveLater}
      </p>
    </section>
  );
}
