import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, MessageSquare, UserPlus, MapPin, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  trip_id: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

function iconFor(type: string) {
  switch (type) {
    case "comment": return MessageSquare;
    case "companion_joined":
    case "invite_accepted": return UserPlus;
    case "trip_reminder": return CalendarClock;
    default: return MapPin;
  }
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nå";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t`;
  const dd = Math.floor(h / 24);
  return `${dd} d`;
}

export function NotificationBell({
  onIncoming,
}: {
  onIncoming?: (n: AppNotification) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const onIncomingRef = useRef(onIncoming);
  onIncomingRef.current = onIncoming;

  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled && data) setItems(data as AppNotification[]);
    })();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => [n, ...prev].slice(0, 10));
          onIncomingRef.current?.(n);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => prev.map((x) => x.id === n.id ? n : x));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!user) return;
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Varsler"
        className="relative grid place-items-center h-9 w-9 rounded-full hover:bg-surface-2 text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold">Varsler</span>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={unread === 0}
            >
              Merk alle som lest
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Ingen varsler enda
              </li>
            )}
            {items.map((n) => {
              const Icon = iconFor(n.type);
              const content = (
                <div className={cn(
                  "flex items-start gap-3 px-3 py-2.5 hover:bg-surface-2 cursor-pointer",
                  !n.read && "bg-surface-2/40",
                )}>
                  <div className="mt-0.5 grid place-items-center h-8 w-8 rounded-full bg-primary/10 text-primary shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
              );
              return (
                <li key={n.id} onClick={() => { markRead(n.id); setOpen(false); }}>
                  {n.link ? (
                    <Link to={n.link as never}>{content}</Link>
                  ) : content}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
