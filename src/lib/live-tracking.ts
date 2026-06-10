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

// ---------- broadcaster hook ----------
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
  const autoSendThrottleMs = 5_000;
  const debugMovementThresholdKm = 0.003;
  const pollIntervalMs = 10_000;
  const lastPosRef = useRef<LivePosition | null>(null);
  const lastSentRef = useRef<LivePosition | null>(null);
  const lastAutoSentAtRef = useRef(0);
  const gpsFixCountRef = useRef(0);
  const permStateRef = useRef<LivePermissionState>("unknown");
  const [permState, setPermStateRaw] = useState<LivePermissionState>("unknown");

  const broadcastable = enabled && !!tripId && !!userId && (status === "active" || status === "paused");
  const pollingActive = enabled && !!tripId && !!userId && status === "active";
  const [debug, setDebug] = useState<LiveBroadcasterDebugState>(() => createLiveBroadcasterDebugState({
    enabled,
    status,
    broadcastable,
    permissionState: "unknown",
  }));

  const updateDebug = (patch: Partial<LiveBroadcasterDebugState>) => {
    setDebug((prev) => ({ ...prev, ...patch }));
  };

  const setPermState = (next: LivePermissionState) => {
    if (permStateRef.current === next) return;
    permStateRef.current = next;
    updateDebug({ permissionState: next });
    try { setPermStateRaw(next); } catch (e) { console.warn("[live] setPermState failed", e); }
  };

  useEffect(() => {
    setDebug((prev) => ({
      ...prev,
      broadcastable,
      liveOn: enabled,
      tripStatus: status,
      permissionState: permStateRef.current,
      watchStarted: broadcastable ? prev.watchStarted : false,
      watchId: broadcastable ? prev.watchId : null,
      watchIdExists: broadcastable ? prev.watchIdExists : false,
      heartbeatIntervalActive: broadcastable ? prev.heartbeatIntervalActive : false,
      pollingActive: pollingActive ? prev.pollingActive : false,
      canSendImmediate: broadcastable ? Date.now() - lastAutoSentAtRef.current >= autoSendThrottleMs : false,
    }));
  }, [autoSendThrottleMs, broadcastable, enabled, pollingActive, status]);

  const sendCurrentPosition = async (source: LiveDebugSendSource) => {
    const liveStatus = status === "active" || status === "paused" || status === "completed"
      ? status
      : null;
    const attemptTime = new Date().toISOString();

    // Throttle automatic sources (watch/poll/heartbeat). Manual always sends.
    if (source !== "manual") {
      const sinceLast = Date.now() - lastAutoSentAtRef.current;
      if (sinceLast < autoSendThrottleMs) {
        return { ok: false as const, error: `throttled (${sinceLast}ms < ${autoSendThrottleMs}ms)` };
      }
    }

    updateDebug({
      lastUpsertError: null,
      ...(source === "manual"
        ? { lastManualUpsertAttemptTime: attemptTime }
        : source === "heartbeat"
          ? { lastHeartbeatUpsertAttemptTime: attemptTime, lastHeartbeatUpsertError: null }
          : {
              lastAutomaticUpsertAttemptTime: attemptTime,
              lastAutomaticUpsertError: null,
              lastSendSource: source,
            }),
    });

    if (!tripId || !userId || !liveStatus) {
      const message = "Live broadcaster is not in a sendable state.";
      updateDebug({
        lastUpsertError: message,
        ...(source === "heartbeat" ? { lastHeartbeatUpsertError: message } : {}),
        ...(source === "immediate" || source === "poll" ? { lastAutomaticUpsertError: message, lastSendSource: source } : {}),
      });
      return { ok: false as const, error: message };
    }
    const pos = lastPosRef.current;
    if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
      const message = "No valid GPS fix available to send.";
      updateDebug({
        lastUpsertError: message,
        ...(source === "heartbeat" ? { lastHeartbeatUpsertError: message } : {}),
        ...(source === "immediate" || source === "poll" ? { lastAutomaticUpsertError: message, lastSendSource: source } : {}),
      });
      return { ok: false as const, error: message };
    }

    let preparedPayload: LiveUpsertDebugPayload | null = null;

    try {
      const result = await upsertLiveSession({
        tripId,
        userId,
        pos,
        status: liveStatus,
        lastStopName: lastStopName ?? null,
        onPreparedPayload: (payload) => {
          preparedPayload = payload;
          updateDebug({ lastUpsertPayload: payload, lastUpsertError: null });
        },
      });

      lastSentRef.current = { ...pos };
      if (source !== "manual") lastAutoSentAtRef.current = Date.now();

      const successTime = new Date().toISOString();
      updateDebug({
        lastUpsertPayload: preparedPayload ?? result.payload,
        lastStoredRow: result.storedRow,
        lastUpsertError: null,
        canSendImmediate: Date.now() - lastAutoSentAtRef.current >= autoSendThrottleMs,
        ...(source === "immediate" || source === "poll"
          ? {
              lastAutomaticUpsertSuccessTime: successTime,
              lastAutomaticUpsertError: null,
              lastSendSource: source,
            }
          : {}),
        ...(source === "heartbeat" ? { lastHeartbeatUpsertSuccessTime: successTime, lastHeartbeatUpsertError: null } : {}),
        ...(source === "manual" ? { lastManualUpsertSuccessTime: successTime } : {}),
      });

      console.log(`[live] ${source} upsert success`, result.storedRow ?? result.payload);
      return { ok: true as const, payload: result.payload, storedRow: result.storedRow };
    } catch (error) {
      const message = toErrorMessage(error);
      updateDebug({
        lastUpsertPayload: preparedPayload,
        lastUpsertError: message,
        ...(source === "heartbeat" ? { lastHeartbeatUpsertError: message } : {}),
        ...(source === "immediate" || source === "poll" ? { lastAutomaticUpsertError: message, lastSendSource: source } : {}),
      });
      console.warn(`[live] ${source} upsert failed`, message);
      return { ok: false as const, error: message };
    }
  };

  // Cache latest GPS fix into lastPosRef and trigger an automatic send.
  // No movement gate — sendCurrentPosition throttles automatic sources internally.
  const ingestGpsFix = (source: LiveGeolocationSource, p: GeolocationPosition) => {
    setPermState("granted");
    const next: LivePosition = {
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
      speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
      updatedAt: new Date().toISOString(),
    };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const prevGps = lastPosRef.current;
    let distanceSincePrevGpsKm: number | null = null;
    let distanceSinceLastSentKm: number | null = null;
    if (prevGps) {
      try {
        distanceSincePrevGpsKm = distanceKm(
          { lat: prevGps.lat, lng: prevGps.lng },
          { lat: next.lat, lng: next.lng },
        );
        if (status === "active" && distanceSincePrevGpsKm >= 0.005 && distanceSincePrevGpsKm <= 2) {
          trackingApi.addDistance(tripId, distanceSincePrevGpsKm);
        }
      } catch (e) {
        console.warn("[live] distance accumulation failed", e);
      }
    }
    const lastSent = lastSentRef.current;
    if (lastSent) {
      distanceSinceLastSentKm = distanceKm(
        { lat: lastSent.lat, lng: lastSent.lng },
        { lat: next.lat, lng: next.lng },
      );
    }

    lastPosRef.current = next;
    gpsFixCountRef.current += 1;

    updateDebug({
      lastGpsFixTime: next.updatedAt ?? null,
      lastGpsFixLat: next.lat,
      lastGpsFixLng: next.lng,
      lastGpsAccuracy: next.accuracy ?? null,
      previousGpsLat: prevGps?.lat ?? null,
      previousGpsLng: prevGps?.lng ?? null,
      distanceSincePreviousGpsKm: distanceSincePrevGpsKm,
      distanceSinceLastSentKm,
      gpsFixCount: gpsFixCountRef.current,
      movedEnough: true,
      canSendImmediate: Date.now() - lastAutoSentAtRef.current >= autoSendThrottleMs,
    });

    console.log("[live] gps fix received", {
      source,
      lat: next.lat,
      lng: next.lng,
      accuracy: next.accuracy ?? null,
      gpsFixCount: gpsFixCountRef.current,
    });

    const sendSource: LiveDebugSendSource = source === "poll" ? "poll" : "immediate";
    void sendCurrentPosition(sendSource);
  };

  useEffect(() => {
    if (!broadcastable) {
      updateDebug({
        watchStarted: false,
        watchId: null,
        watchIdExists: false,
        heartbeatIntervalActive: false,
        pollingActive: false,
        canSendImmediate: false,
      });
      return;
    }

    // Guard browser-only APIs (SSR + non-geolocation contexts).
    if (typeof window === "undefined" || typeof navigator === "undefined" || !("geolocation" in navigator) || !navigator.geolocation) {
      setPermState("denied");
      updateDebug({
        watchStarted: false,
        watchId: null,
        watchIdExists: false,
        heartbeatIntervalActive: false,
        pollingActive: false,
        canSendImmediate: false,
      });
      return;
    }

    let stopped = false;
    let watchId: number | null = null;
    let pollId: number | null = null;

    const sendHeartbeat = async () => {
      if (stopped) return;
      const result = await sendCurrentPosition("heartbeat");
      if (result.ok) {
        console.log("[live] heartbeat upsert success", result.storedRow ?? result.payload);
      } else {
        console.warn("[live] heartbeat upsert failed", result.error);
      }
    };


    try {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          if (stopped) return;
          void (async () => {
            try {
              await ingestGpsFix("watch", p);
            } catch (e) {
              console.warn("[live] watchPosition success handler failed", e);
            }
          })();
        },
        (err) => {
          if (stopped) return;
          try {
            if (err && err.code === err.PERMISSION_DENIED) setPermState("denied");
            updateDebug({ lastUpsertError: err?.message ?? "Geolocation error" });
            console.warn("[live] geolocation error", err?.message);
          } catch (e) {
            console.warn("[live] watchPosition error handler failed", e);
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
      updateDebug({
        watchStarted: true,
        watchId,
        watchIdExists: watchId !== null,
        heartbeatIntervalActive: true,
        pollingActive,
        canSendImmediate: Date.now() - lastAutoSentAtRef.current >= autoSendThrottleMs,
      });
    } catch (e) {
      console.warn("[live] watchPosition failed", e);
      setPermState("denied");
      updateDebug({
        watchStarted: false,
        watchId: null,
        watchIdExists: false,
        heartbeatIntervalActive: false,
        pollingActive: false,
        lastUpsertError: toErrorMessage(e),
      });
    }

    if (pollingActive) {
      pollId = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            if (stopped) return;
            void ingestGpsFix("poll", p);
          },
          (err) => {
            if (stopped) return;
            if (err && err.code === err.PERMISSION_DENIED) setPermState("denied");
            const message = err?.message ?? "Poll geolocation error";
            updateDebug({ lastUpsertError: message });
            console.warn("[live] getCurrentPosition poll failed", message);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
        );
      }, pollIntervalMs);
    }

    const initial = setTimeout(() => { void sendHeartbeat(); }, 2_000);
    const timer = setInterval(() => { void sendHeartbeat(); }, interval);

    return () => {
      stopped = true;
      clearTimeout(initial);
      clearInterval(timer);
      if (pollId !== null) window.clearInterval(pollId);
      updateDebug({
        watchStarted: false,
        watchId: null,
        watchIdExists: false,
        heartbeatIntervalActive: false,
        pollingActive: false,
        canSendImmediate: false,
      });
      if (watchId !== null && navigator.geolocation?.clearWatch) {
        try { navigator.geolocation.clearWatch(watchId); }
        catch (e) { console.warn("[live] clearWatch failed", e); }
      }
    };
  }, [
    autoSendThrottleMs,
    broadcastable,
    debugMovementThresholdKm,
    interval,
    lastStopName,
    pollIntervalMs,
    pollingActive,
    status,
    tripId,
    userId,
  ]);

  useEffect(() => {
    if (!enabled || !userId) return;
    if (status === "completed") {
      void updateLiveStatus({ tripId, userId, status: "completed" });
    }
  }, [enabled, status, tripId, userId]);

  return {
    permState,
    debug,
    sendTestPositionNow: async () => {
      const result = await sendCurrentPosition("manual");
      return result.ok;
    },
  };
}

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
