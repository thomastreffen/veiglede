// Live trip sharing — broadcast & subscribe to current position.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { distanceKm } from "@/lib/geo";
import { trackingApi } from "@/lib/trip-tracking";

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
  live_share_token: string;
}

export interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  updatedAt?: string;
}

export type LivePermissionState = "unknown" | "granted" | "denied" | "prompt";

type LiveDebugSendSource = "immediate" | "heartbeat" | "manual" | "poll";
type LiveGeolocationSource = "watch" | "poll";

export interface LiveUpsertDebugPayload {
  trip_id: string;
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  last_stop_name: string | null;
  status: LiveStatus;
  updated_at: string;
  last_seen_at: string;
  live_share_token: string;
}

export interface LiveStoredRowSnapshot {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  status: LiveStatus;
  updated_at: string;
  live_share_token: string;
}

export interface LiveBroadcasterDebugState {
  broadcastable: boolean;
  liveOn: boolean;
  tripStatus: LiveStatus | "idle";
  permissionState: LivePermissionState;
  watchStarted: boolean;
  watchId: number | null;
  watchIdExists: boolean;
  gpsFixCount: number;
  heartbeatIntervalActive: boolean;
  pollingActive: boolean;
  lastGpsFixTime: string | null;
  lastGpsFixLat: number | null;
  lastGpsFixLng: number | null;
  lastGpsAccuracy: number | null;
  previousGpsLat: number | null;
  previousGpsLng: number | null;
  distanceSincePreviousGpsKm: number | null;
  distanceSinceLastSentKm: number | null;
  movedEnough: boolean;
  canSendImmediate: boolean;
  lastAutomaticUpsertAttemptTime: string | null;
  lastAutomaticUpsertSuccessTime: string | null;
  lastAutomaticUpsertError: string | null;
  lastSendSource: LiveDebugSendSource | null;
  lastHeartbeatUpsertAttemptTime: string | null;
  lastHeartbeatUpsertSuccessTime: string | null;
  lastHeartbeatUpsertError: string | null;
  lastManualUpsertAttemptTime: string | null;
  lastManualUpsertSuccessTime: string | null;
  lastUpsertPayload: LiveUpsertDebugPayload | null;
  lastStoredRow: LiveStoredRowSnapshot | null;
  lastUpsertError: string | null;
  pageVisibility: "visible" | "hidden";
  lastVisibilityChangeTime: string | null;
  lastResumeSendTime: string | null;
  wakeLockActive: boolean;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); }
  catch { return "Unknown error"; }
}

function createLiveBroadcasterDebugState(input: {
  enabled: boolean;
  status: LiveStatus | "idle";
  broadcastable: boolean;
  permissionState: LivePermissionState;
}): LiveBroadcasterDebugState {
  return {
    broadcastable: input.broadcastable,
    liveOn: input.enabled,
    tripStatus: input.status,
    permissionState: input.permissionState,
    watchStarted: false,
    watchId: null,
    watchIdExists: false,
    gpsFixCount: 0,
    heartbeatIntervalActive: false,
    pollingActive: false,
    lastGpsFixTime: null,
    lastGpsFixLat: null,
    lastGpsFixLng: null,
    lastGpsAccuracy: null,
    previousGpsLat: null,
    previousGpsLng: null,
    distanceSincePreviousGpsKm: null,
    distanceSinceLastSentKm: null,
    movedEnough: false,
    canSendImmediate: false,
    lastAutomaticUpsertAttemptTime: null,
    lastAutomaticUpsertSuccessTime: null,
    lastAutomaticUpsertError: null,
    lastSendSource: null,
    lastHeartbeatUpsertAttemptTime: null,
    lastHeartbeatUpsertSuccessTime: null,
    lastHeartbeatUpsertError: null,
    lastManualUpsertAttemptTime: null,
    lastManualUpsertSuccessTime: null,
    lastUpsertPayload: null,
    lastStoredRow: null,
    lastUpsertError: null,
    pageVisibility: typeof document !== "undefined" && document.visibilityState === "hidden" ? "hidden" : "visible",
    lastVisibilityChangeTime: null,
    lastResumeSendTime: null,
    wakeLockActive: false,
  };
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

// ---------- share-token cache (per tripId+userId) ----------
const tokenCache = new Map<string, string>();
function cacheKey(tripId: string, userId: string) { return `${tripId}::${userId}`; }

async function ensureShareToken(tripId: string, userId: string): Promise<string> {
  const key = cacheKey(tripId, userId);
  const cached = tokenCache.get(key);
  if (cached) return cached;
  // Look up existing row to reuse its token.
  const { data } = await (supabase as any)
    .from("trip_live_sessions")
    .select("live_share_token")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  const existing = (data as { live_share_token?: string } | null)?.live_share_token;
  if (existing) {
    tokenCache.set(key, existing);
    return existing;
  }
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  tokenCache.set(key, fresh);
  return fresh;
}

// ---------- write API ----------
export async function upsertLiveSession(input: {
  tripId: string;
  userId: string;
  pos: LivePosition;
  status: LiveStatus;
  lastStopName?: string | null;
  onPreparedPayload?: (payload: LiveUpsertDebugPayload) => void;
}) {
  const token = await ensureShareToken(input.tripId, input.userId);
  const timestamp = new Date().toISOString();
  const payload: LiveUpsertDebugPayload = {
    trip_id: input.tripId,
    user_id: input.userId,
    lat: input.pos.lat,
    lng: input.pos.lng,
    accuracy: input.pos.accuracy ?? null,
    heading: input.pos.heading ?? null,
    speed: input.pos.speed ?? null,
    last_stop_name: input.lastStopName ?? null,
    status: input.status,
    updated_at: timestamp,
    last_seen_at: timestamp,
    live_share_token: token,
  };
  input.onPreparedPayload?.(payload);
  console.log("[live] upsert payload", payload);
  const row = {
    trip_id: payload.trip_id,
    user_id: payload.user_id,
    lat: payload.lat,
    lng: payload.lng,
    heading: payload.heading,
    speed: payload.speed,
    last_stop_name: payload.last_stop_name,
    status: payload.status,
    updated_at: payload.updated_at,
    live_share_token: payload.live_share_token,
  };
  const { data, error } = await (supabase as any)
    .from("trip_live_sessions")
    .upsert(row, { onConflict: "trip_id,user_id" })
    .select("lat,lng,heading,speed,status,updated_at,live_share_token")
    .single();
  if (error) throw error;
  return {
    payload,
    storedRow: ((Array.isArray(data) ? data[0] : data) as LiveStoredRowSnapshot | null) ?? null,
  };
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
  tokenCache.delete(cacheKey(input.tripId, input.userId));
  const { error } = await (supabase as any)
    .from("trip_live_sessions")
    .delete()
    .eq("trip_id", input.tripId)
    .eq("user_id", input.userId);
  if (error) console.warn("[live] delete failed", error);
}

// ---------- broadcaster hook (thin React adapter) ----------
// The geolocation watch, heartbeat, wake-lock and Supabase publishing logic
// now live in WebLiveBroadcaster (src/lib/live/web-broadcaster.ts), behind
// the LiveBroadcaster interface (src/lib/live/types.ts). This hook is just
// a React wrapper around the singleton broadcaster so the trip UI keeps a
// stable API. A future NativeLiveBroadcaster will swap in via the factory
// without changes here.
//
// We re-export the adapter under the legacy name so existing callers
// (TripTracker, etc.) keep working unchanged.
export { useLiveBroadcasterAdapter as useLiveBroadcaster } from "@/lib/live/use-broadcaster";

// `permState` is retained on the return type for back-compat — derived from
// the snapshot's debug.permissionState by callers if needed.
// Type stays in this module: see LivePermissionState / LiveBroadcasterDebugState above.


// ---------- subscriber hooks ----------
function subscribeAndSet(
  filter: { column: "trip_id" | "live_share_token"; value: string },
  setSession: (s: LiveSession | null) => void,
) {
  const channel = supabase
    .channel(`live-${filter.column}-${filter.value}`)
    .on(
      // @ts-expect-error realtime types
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "trip_live_sessions",
        filter: `${filter.column}=eq.${filter.value}`,
      },
      (payload: { eventType: string; new: LiveSession | null; old: LiveSession | null }) => {
        if (payload.eventType === "DELETE") setSession(null);
        else if (payload.new) setSession(payload.new);
      },
    )
    .subscribe();
  return channel;
}

/** Fetch and subscribe to the live session for a trip (auth or anon via RLS). */
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

    const channel = subscribeAndSet({ column: "trip_id", value: tripId }, setSession);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  return session;
}

/** Public, token-based lookup — works without an authenticated session. */
export function useLiveSessionByToken(token: string | null | undefined): {
  session: LiveSession | null;
  loading: boolean;
} {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!token) { setSession(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const { data } = await (supabase as any)
        .rpc("get_live_session_by_token", { p_token: token });
      if (cancelled) return;
      // RPC returns the row directly (or null if no match)
      const row = Array.isArray(data) ? data[0] : data;
      setSession((row as LiveSession | null) ?? null);
      setLoading(false);
    };
    void load();

    // Auto-refresh poll (anon viewers cannot use realtime — RLS scopes to authenticated owners/companions).
    const retry = setInterval(() => { if (!cancelled) void load(); }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(retry);
    };
  }, [token]);

  return { session, loading };
}

export function isLiveActive(s: LiveSession | null): boolean {
  if (!s) return false;
  if (s.status === "completed") return false;
  const age = Date.now() - new Date(s.updated_at).getTime();
  return age < 5 * 60 * 1000;
}
