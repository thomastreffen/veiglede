import { useEffect, useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listTripComments, addTripComment, deleteTripComment,
  MAX_COMMENT_LEN, type TripComment,
} from "@/lib/trip-comments";
import { AvatarImg } from "@/lib/avatar";

interface Props {
  tripId: string;
}

export function TripComments({ tripId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<TripComment[] | null>(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setAllowed(false); setComments([]); return; }
    listTripComments(tripId)
      .then((rows) => { if (!cancelled) { setComments(rows); setAllowed(true); } })
      .catch(() => { if (!cancelled) { setAllowed(false); setComments([]); } });
    return () => { cancelled = true; };
  }, [tripId, user]);

  useEffect(() => {
    if (!user || !allowed) return;
    const channel = supabase
      .channel(`trip_comments:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_comments", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const c = payload.new as TripComment;
            setComments((prev) => prev && prev.some((x) => x.id === c.id) ? prev : [...(prev ?? []), c]);
          } else if (payload.eventType === "DELETE") {
            const c = payload.old as TripComment;
            setComments((prev) => (prev ?? []).filter((x) => x.id !== c.id));
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tripId, user, allowed]);

  if (!user) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-border bg-surface/40 p-5 text-center">
        <MessageCircle className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Logg inn for å se og skrive kommentarer.</p>
      </section>
    );
  }
  if (!allowed) {
    return null;
  }

  const submit = async () => {
    setError(null);
    setPosting(true);
    try {
      const c = await addTripComment(tripId, content);
      setComments((prev) => prev && prev.some((x) => x.id === c.id) ? prev : [...(prev ?? []), c]);
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke poste");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTripComment(id);
      setComments((prev) => (prev ?? []).filter((x) => x.id !== id));
    } catch { /* noop */ }
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
      <h3 className="inline-flex items-center gap-2 font-display text-xl uppercase">
        <MessageCircle className="h-4 w-4 text-primary" /> Kommentarer
      </h3>

      <ul className="mt-4 space-y-3">
        {(comments ?? []).map((c) => (
          <li key={c.id} className="flex gap-2.5 rounded-xl border border-border/60 bg-background/40 p-3">
            <span className="h-8 w-8 rounded-full bg-primary/15 grid place-items-center text-[11px] font-bold text-primary shrink-0 overflow-hidden">
              {c.user_avatar_url ? (
                <AvatarImg value={c.user_avatar_url} className="h-full w-full object-cover" />
              ) : (
                (c.user_name?.[0] ?? "?").toUpperCase()
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-xs font-bold truncate">{c.user_name ?? "Anonym"}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatWhen(c.created_at)}</p>
              </div>
              <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{c.content}</p>
            </div>
            {c.user_id === user.id && (
              <button
                onClick={() => remove(c.id)}
                aria-label="Slett kommentar"
                className="self-start text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {comments && comments.length === 0 && (
          <li className="text-xs text-muted-foreground">Ingen kommentarer enda.</li>
        )}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_COMMENT_LEN))}
          placeholder="Skriv en kommentar…"
          rows={2}
          className="flex-1 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary resize-none"
        />
        <button
          onClick={submit}
          disabled={posting || !content.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Post
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{error}</span>
        <span>{content.length}/{MAX_COMMENT_LEN}</span>
      </div>
    </section>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}
