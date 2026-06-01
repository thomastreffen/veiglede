// Live trip sharing — broadcast & subscribe to current position.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "vg.live-sharing.optin.v1";

export type LiveStatus = "active" | "paused" | "completed";

export interface LiveSession {
  trip_id: string;
  user_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  last_stop_name: string | null;
  status: LiveStatus;
  updated_at: string;
}

export interface LivePosition {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
}

// ---------- per-trip opt-in (localStorage) ----------
function readOptInMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
  catch { return {}; }
}
function writeOptInMap(m: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(m));
  window.dispatchEvent(new Event("vg:live-optin-change"));
}
export function isLiveOptIn(tripId: string): boolean {
  return Boolean(readOptInMap()[tripId]);
}
export function setLiveOptIn(tripId: string, on: boolean) {
  const m = readOptInMap();
  if (on) m[tripId] = true; else delete m[tripId];
  writeOptInMap(m);
}
export function useLiveOptIn(tripId: string): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => isLiveOptIn(tripId));
  useEffect(() => {
    const sync = () => setOn(isLiveOptIn(tripId));
    window.addEventListener("vg:live-optin-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vg:live-optin-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [tripId]);
  return [on, (v) => setLiveOptIn(tripId, v)];
}

// ---------- write API ----------
export async function upsertLiveSession(input: {
  tripId: string;
  userId: string;
  pos: LivePosition;
  status: LiveStatus;
  lastStopName?: string | null;
}) {
  const row = {
    trip_id: input.tripId,
    user_id: input.userId,
    lat: input.pos.lat,
    lng: input.pos.lng,
    heading: input.pos.heading ?? null,
    speed: input.pos.speed ?? null,
    last_stop_name: input.lastStopName ?? null,
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  // Types may not yet include this table; cast for safety.
  const { error } = await (supabase as any)
    .from("trip_live_sessions")
    .upsert(row, { onConflict: "trip_id,user_id" });
  if (error) console.warn("[live] upsert failed", error);
}

export async function updateLiveStatus(input: {
  tripId: string;
  userId: string;
  status: LiveStatus;
}) {
  const { error } = await (supabase as any)
    .from("trip_live_sessions")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("trip_id", input.tripId)
    .eq("user_id", input.userId);
  if (error) console.warn("[live] status update failed", error);
}

export async function endLiveSession(input: { tripId: string; userId: string }) {
  const { error } = await (supabase as any)
    .from("trip_live_sessions")
    .delete()
    .eq("trip_id", input.tripId)
    .eq("user_id", input.userId);
  if (error) console.warn("[live] delete failed", error);
}

// ---------- broadcaster hook ----------
/**
 * Periodically reads geolocation and upserts the live session.
 * Only runs when `enabled` is true and we have an authenticated user.
 */
export function useLiveBroadcaster(opts: {
  tripId: string;
  userId: string | null | undefined;
  enabled: boolean;
  status: LiveStatus | "idle";
  lastStopName?: string | null;
  intervalMs?: number;
}) {
  const { tripId, userId, enabled, status, lastStopName } = opts;
  const interval = opts.intervalMs ?? 30_000;
  const lastPosRef = useRef<LivePosition | null>(null);
  const [permState, setPermState] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");

  const broadcastable = enabled && !!userId && (status === "active" || status === "paused");

  useEffect(() => {
    if (!broadcastable) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermState("denied");
      return;
    }

    let stopped = false;
    let watchId: number | null = null;

    const send = async () => {
      const pos = lastPosRef.current;
      if (!pos || stopped) return;
      await upsertLiveSession({
        tripId,
        userId: userId!,
        pos,
        status: status as LiveStatus,
        lastStopName: lastStopName ?? null,
      });
    };

    watchId = navigator.geolocation.watchPosition(
      (p) => {
        setPermState("granted");
        lastPosRef.current = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          heading: p.coords.heading,
          speed: p.coords.speed,
        };
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermState("denied");
        console.warn("[live] geolocation error", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    // Send right away (once we have a fix) and on an interval
    const initial = setTimeout(() => void send(), 2_000);
    const timer = setInterval(() => void send(), interval);

    return () => {
      stopped = true;
      clearTimeout(initial);
      clearInterval(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [broadcastable, tripId, userId, status, lastStopName, interval]);

  // When user pauses/completes, reflect status immediately.
  useEffect(() => {
    if (!enabled || !userId) return;
    if (status === "completed") {
      void updateLiveStatus({ tripId, userId, status: "completed" });
    }
  }, [enabled, status, tripId, userId]);

  return { permState };
}

// ---------- subscriber hook ----------
/**
 * Fetches the current live session for a trip and subscribes to realtime updates.
 * Returns the latest session row (or null if none active).
 */
export function useLiveSession(tripId: string | null | undefined): LiveSession | null {
  const [session, setSession] = useState<LiveSession | null>(null);

  useEffect(() => {
    if (!tripId) { setSession(null); return; }
    let cancelled = false;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("trip_live_sessions")
        .select("*")
        .eq("trip_id", tripId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setSession((data as LiveSession | null) ?? null);
    };
    void load();

    const channel = supabase
      .channel(`live-${tripId}`)
      .on(
        // @ts-expect-error realtime types
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_live_sessions", filter: `trip_id=eq.${tripId}` },
        (payload: { eventType: string; new: LiveSession | null; old: LiveSession | null }) => {
          if (payload.eventType === "DELETE") {
            setSession(null);
          } else if (payload.new) {
            setSession(payload.new);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  return session;
}

export function isLiveActive(s: LiveSession | null): boolean {
  if (!s) return false;
  if (s.status === "completed") return false;
  // Consider stale after 5 minutes without updates
  const age = Date.now() - new Date(s.updated_at).getTime();
  return age < 5 * 60 * 1000;
}
