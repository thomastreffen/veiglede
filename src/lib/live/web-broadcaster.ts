// WebLiveBroadcaster — owns geolocation watch, heartbeat, wake-lock, and
// position publishing for the web platform. One instance manages one trip
// at a time (matching current product behavior).
import { distanceKm } from "@/lib/geo";
import { trackingApi } from "@/lib/trip-tracking";
import {
  upsertLiveSession,
  updateLiveStatus,
  type LiveBroadcasterDebugState,
  type LivePermissionState,
  type LivePosition,
  type LiveStatus,
  type LiveUpsertDebugPayload,
} from "@/lib/live-tracking";
import {
  emptySnapshot,
  type BroadcastSnapshot,
  type BroadcastStatus,
  type LiveBroadcaster,
  type PositionListener,
  type PositionPublishedEvent,
  type StartOptions,
  type StatusListener,
  type Unsubscribe,
} from "./types";

type SendSource = "immediate" | "heartbeat" | "manual" | "poll" | "resume";
const AUTO_SEND_THROTTLE_MS = 5_000;
const POLL_INTERVAL_MS = 10_000;
const DEFAULT_HEARTBEAT_MS = 30_000;
const STALE_AFTER_MS = 2 * 60_000;

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

function makeDebug(input: {
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
    pageVisibility:
      typeof document !== "undefined" && document.visibilityState === "hidden"
        ? "hidden"
        : "visible",
    lastVisibilityChangeTime: null,
    lastResumeSendTime: null,
    wakeLockActive: false,
  };
}

interface TripState {
  options: StartOptions;
  snapshot: BroadcastSnapshot;
  debug: LiveBroadcasterDebugState;
  permState: LivePermissionState;
  lastPos: LivePosition | null;
  lastSent: LivePosition | null;
  lastAutoSentAt: number;
  gpsFixCount: number;
  watchId: number | null;
  pollId: number | null;
  heartbeatInitial: ReturnType<typeof setTimeout> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  staleTimer: ReturnType<typeof setInterval> | null;
  wakeLock: { release: () => Promise<void> } | null;
  visibilityHandler: (() => void) | null;
  statusListeners: Set<StatusListener>;
  positionListeners: Set<PositionListener>;
  stopped: boolean;
}

export class WebLiveBroadcaster implements LiveBroadcaster {
  readonly kind = "web" as const;
  private trips = new Map<string, TripState>();

  // ----- public API -----

  async start(tripId: string, options: StartOptions): Promise<void> {
    const existing = this.trips.get(tripId);
    if (existing) {
      // Re-start = update options + (re)attach if not already attached.
      this.update(tripId, options);
      if (existing.watchId === null) this.attach(tripId);
      return;
    }
    const debug = makeDebug({
      enabled: true,
      status: options.tripStatus,
      broadcastable: this.computeBroadcastable(options),
      permissionState: "unknown",
    });
    const state: TripState = {
      options,
      snapshot: { ...emptySnapshot(tripId), status: "starting" },
      debug,
      permState: "unknown",
      lastPos: null,
      lastSent: null,
      lastAutoSentAt: 0,
      gpsFixCount: 0,
      watchId: null,
      pollId: null,
      heartbeatInitial: null,
      heartbeatTimer: null,
      staleTimer: null,
      wakeLock: null,
      visibilityHandler: null,
      statusListeners: new Set(),
      positionListeners: new Set(),
      stopped: false,
    };
    this.trips.set(tripId, state);
    this.emitStatus(tripId);
    this.attach(tripId);
  }

  async stop(tripId: string): Promise<void> {
    const s = this.trips.get(tripId);
    if (!s) return;
    s.stopped = true;
    this.detach(tripId);
    s.snapshot = { ...s.snapshot, status: "stopped" };
    this.emitStatus(tripId);
    // Listeners may still want the "stopped" event; remove state next tick.
    setTimeout(() => {
      const cur = this.trips.get(tripId);
      if (cur === s) this.trips.delete(tripId);
    }, 0);
  }

  update(tripId: string, patch: Partial<StartOptions>): void {
    const s = this.trips.get(tripId);
    if (!s) return;
    const next: StartOptions = { ...s.options, ...patch };
    const wasBroadcastable = this.computeBroadcastable(s.options);
    const isBroadcastable = this.computeBroadcastable(next);
    s.options = next;
    s.debug = {
      ...s.debug,
      tripStatus: next.tripStatus,
      broadcastable: isBroadcastable,
    };

    // Mirror trip status changes to the server (completed in particular).
    if (next.tripStatus === "completed") {
      void updateLiveStatus({
        tripId,
        userId: next.userId,
        status: "completed",
      });
    }

    if (wasBroadcastable !== isBroadcastable) {
      if (isBroadcastable) this.attach(tripId);
      else this.detach(tripId);
    }
    this.recomputeStatus(tripId);
  }

  getStatus(tripId: string): BroadcastSnapshot {
    const s = this.trips.get(tripId);
    if (!s) return emptySnapshot(tripId);
    return s.snapshot;
  }

  subscribeStatus(tripId: string, cb: StatusListener): Unsubscribe {
    const s = this.ensureListenerHost(tripId);
    s.statusListeners.add(cb);
    // Push current snapshot immediately.
    try { cb(s.snapshot); } catch { /* noop */ }
    return () => { s.statusListeners.delete(cb); };
  }

  subscribePositionPublished(tripId: string, cb: PositionListener): Unsubscribe {
    const s = this.ensureListenerHost(tripId);
    s.positionListeners.add(cb);
    return () => { s.positionListeners.delete(cb); };
  }

  async sendNow(tripId: string): Promise<boolean> {
    const r = await this.sendCurrentPosition(tripId, "manual");
    return r.ok;
  }

  // ----- internals -----

  private ensureListenerHost(tripId: string): TripState {
    let s = this.trips.get(tripId);
    if (!s) {
      // Create a passive shell for subscribers attaching before start().
      s = {
        options: {
          userId: "",
          tripStatus: "idle",
        },
        snapshot: emptySnapshot(tripId),
        debug: makeDebug({
          enabled: false, status: "idle", broadcastable: false, permissionState: "unknown",
        }),
        permState: "unknown",
        lastPos: null, lastSent: null, lastAutoSentAt: 0, gpsFixCount: 0,
        watchId: null, pollId: null,
        heartbeatInitial: null, heartbeatTimer: null, staleTimer: null,
        wakeLock: null, visibilityHandler: null,
        statusListeners: new Set(), positionListeners: new Set(),
        stopped: false,
      };
      this.trips.set(tripId, s);
    }
    return s;
  }

  private computeBroadcastable(opts: StartOptions): boolean {
    return !!opts.userId &&
      (opts.tripStatus === "active" || opts.tripStatus === "paused");
  }

  private updateDebug(tripId: string, patch: Partial<LiveBroadcasterDebugState>): void {
    const s = this.trips.get(tripId);
    if (!s) return;
    s.debug = { ...s.debug, ...patch };
    this.recomputeStatus(tripId);
  }

  private setPermState(tripId: string, next: LivePermissionState): void {
    const s = this.trips.get(tripId);
    if (!s || s.permState === next) return;
    s.permState = next;
    s.debug = { ...s.debug, permissionState: next };
    this.recomputeStatus(tripId);
  }

  private recomputeStatus(tripId: string): void {
    const s = this.trips.get(tripId);
    if (!s || s.stopped) return;
    const prev = s.snapshot;
    const broadcastable = this.computeBroadcastable(s.options);
    let status: BroadcastStatus = prev.status;

    if (!broadcastable) {
      status = s.options.tripStatus === "completed" ? "stopped" : "idle";
    } else if (s.permState === "denied") {
      status = "error";
    } else if (s.options.tripStatus === "paused") {
      status = "paused";
    } else if (!s.watchId && !s.heartbeatTimer) {
      status = "starting";
    } else {
      const lastAt = s.debug.lastAutomaticUpsertSuccessTime
        ?? s.debug.lastHeartbeatUpsertSuccessTime
        ?? s.debug.lastManualUpsertSuccessTime;
      if (lastAt) {
        const age = Date.now() - new Date(lastAt).getTime();
        status = age > STALE_AFTER_MS ? "stale" : "broadcasting";
      } else {
        status = "starting";
      }
    }

    const lastSentAt = s.debug.lastAutomaticUpsertSuccessTime
      ?? s.debug.lastHeartbeatUpsertSuccessTime
      ?? s.debug.lastManualUpsertSuccessTime
      ?? null;

    const next: BroadcastSnapshot = {
      status,
      tripId,
      lastSentAt,
      lastPosition: s.lastSent ?? s.lastPos,
      errorMessage: s.debug.lastUpsertError ?? null,
      debug: s.debug,
    };
    s.snapshot = next;
    for (const cb of s.statusListeners) {
      try { cb(next); } catch { /* noop */ }
    }
  }

  private emitStatus(tripId: string): void {
    this.recomputeStatus(tripId);
  }

  private emitPosition(tripId: string, position: LivePosition): void {
    const s = this.trips.get(tripId);
    if (!s) return;
    const event: PositionPublishedEvent = {
      tripId,
      position,
      at: position.updatedAt ?? new Date().toISOString(),
    };
    for (const cb of s.positionListeners) {
      try { cb(event); } catch { /* noop */ }
    }
  }

  private async sendCurrentPosition(
    tripId: string,
    source: SendSource,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const s = this.trips.get(tripId);
    if (!s) return { ok: false, error: "No active broadcast" };
    const { userId, tripStatus, lastStopName } = s.options;
    const liveStatus: LiveStatus | null =
      tripStatus === "active" || tripStatus === "paused" || tripStatus === "completed"
        ? tripStatus
        : null;
    const attemptTime = new Date().toISOString();

    if (source !== "manual") {
      const sinceLast = Date.now() - s.lastAutoSentAt;
      if (sinceLast < AUTO_SEND_THROTTLE_MS) {
        return { ok: false, error: `throttled (${sinceLast}ms)` };
      }
    }

    this.updateDebug(tripId, {
      lastUpsertError: null,
      ...(source === "manual"
        ? { lastManualUpsertAttemptTime: attemptTime }
        : source === "heartbeat"
          ? { lastHeartbeatUpsertAttemptTime: attemptTime, lastHeartbeatUpsertError: null }
          : {
              lastAutomaticUpsertAttemptTime: attemptTime,
              lastAutomaticUpsertError: null,
              lastSendSource: source === "resume" ? "poll" : source,
            }),
    });

    if (!userId || !liveStatus) {
      const message = "Live broadcaster is not in a sendable state.";
      this.updateDebug(tripId, { lastUpsertError: message });
      return { ok: false, error: message };
    }
    const pos = s.lastPos;
    if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) {
      const message = "No valid GPS fix available to send.";
      this.updateDebug(tripId, { lastUpsertError: message });
      return { ok: false, error: message };
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
          this.updateDebug(tripId, { lastUpsertPayload: payload, lastUpsertError: null });
        },
      });

      s.lastSent = { ...pos };
      if (source !== "manual") s.lastAutoSentAt = Date.now();
      const successTime = new Date().toISOString();
      this.updateDebug(tripId, {
        lastUpsertPayload: preparedPayload ?? result.payload,
        lastStoredRow: result.storedRow,
        lastUpsertError: null,
        canSendImmediate: true,
        ...(source === "immediate" || source === "poll" || source === "resume"
          ? {
              lastAutomaticUpsertSuccessTime: successTime,
              lastAutomaticUpsertError: null,
              lastSendSource: source === "resume" ? "poll" : source,
            }
          : {}),
        ...(source === "heartbeat" ? { lastHeartbeatUpsertSuccessTime: successTime } : {}),
        ...(source === "manual" ? { lastManualUpsertSuccessTime: successTime } : {}),
      });
      this.emitPosition(tripId, pos);
      console.log(`[live:web] ${source} upsert success`);
      return { ok: true };
    } catch (error) {
      const message = toErrorMessage(error);
      this.updateDebug(tripId, {
        lastUpsertPayload: preparedPayload,
        lastUpsertError: message,
        ...(source === "heartbeat" ? { lastHeartbeatUpsertError: message } : {}),
        ...(source === "immediate" || source === "poll" || source === "resume"
          ? { lastAutomaticUpsertError: message, lastSendSource: source === "resume" ? "poll" : source }
          : {}),
      });
      console.warn(`[live:web] ${source} upsert failed`, message);
      return { ok: false, error: message };
    }
  }

  private ingestGpsFix(tripId: string, source: "watch" | "poll", p: GeolocationPosition): void {
    const s = this.trips.get(tripId);
    if (!s) return;
    this.setPermState(tripId, "granted");
    const next: LivePosition = {
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
      speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
      updatedAt: new Date().toISOString(),
    };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const prev = s.lastPos;
    let distSincePrev: number | null = null;
    if (prev) {
      try {
        distSincePrev = distanceKm(
          { lat: prev.lat, lng: prev.lng },
          { lat: next.lat, lng: next.lng },
        );
        if (
          s.options.tripStatus === "active" &&
          distSincePrev >= 0.005 &&
          distSincePrev <= 2
        ) {
          trackingApi.addDistance(tripId, distSincePrev);
        }
      } catch (e) {
        console.warn("[live:web] distance accumulation failed", e);
      }
    }
    const lastSent = s.lastSent;
    const distSinceSent = lastSent
      ? distanceKm({ lat: lastSent.lat, lng: lastSent.lng }, { lat: next.lat, lng: next.lng })
      : null;

    s.lastPos = next;
    s.gpsFixCount += 1;

    this.updateDebug(tripId, {
      lastGpsFixTime: next.updatedAt ?? null,
      lastGpsFixLat: next.lat,
      lastGpsFixLng: next.lng,
      lastGpsAccuracy: next.accuracy ?? null,
      previousGpsLat: prev?.lat ?? null,
      previousGpsLng: prev?.lng ?? null,
      distanceSincePreviousGpsKm: distSincePrev,
      distanceSinceLastSentKm: distSinceSent,
      gpsFixCount: s.gpsFixCount,
      movedEnough: true,
      canSendImmediate: Date.now() - s.lastAutoSentAt >= AUTO_SEND_THROTTLE_MS,
    });
    void this.sendCurrentPosition(tripId, source === "poll" ? "poll" : "immediate");
  }

  private attach(tripId: string): void {
    const s = this.trips.get(tripId);
    if (!s) return;
    if (s.watchId !== null || s.heartbeatTimer !== null) return; // already attached
    if (typeof window === "undefined" || typeof navigator === "undefined"
        || !("geolocation" in navigator) || !navigator.geolocation) {
      this.setPermState(tripId, "denied");
      return;
    }
    const interval = s.options.intervalMs ?? DEFAULT_HEARTBEAT_MS;

    try {
      s.watchId = navigator.geolocation.watchPosition(
        (p) => {
          const cur = this.trips.get(tripId);
          if (!cur || cur.stopped) return;
          try { this.ingestGpsFix(tripId, "watch", p); }
          catch (e) { console.warn("[live:web] watch handler failed", e); }
        },
        (err) => {
          const cur = this.trips.get(tripId);
          if (!cur || cur.stopped) return;
          if (err && err.code === err.PERMISSION_DENIED) this.setPermState(tripId, "denied");
          this.updateDebug(tripId, { lastUpsertError: err?.message ?? "Geolocation error" });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
      this.updateDebug(tripId, {
        watchStarted: true,
        watchId: s.watchId,
        watchIdExists: s.watchId !== null,
        heartbeatIntervalActive: true,
        pollingActive: s.options.tripStatus === "active",
      });
    } catch (e) {
      console.warn("[live:web] watchPosition failed", e);
      this.setPermState(tripId, "denied");
      this.updateDebug(tripId, { lastUpsertError: toErrorMessage(e) });
    }

    if (s.options.tripStatus === "active") {
      s.pollId = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const cur = this.trips.get(tripId);
            if (!cur || cur.stopped) return;
            this.ingestGpsFix(tripId, "poll", p);
          },
          (err) => {
            if (err && err.code === err.PERMISSION_DENIED) this.setPermState(tripId, "denied");
            this.updateDebug(tripId, { lastUpsertError: err?.message ?? "Poll error" });
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
        );
      }, POLL_INTERVAL_MS);
    }

    s.heartbeatInitial = setTimeout(() => { void this.sendCurrentPosition(tripId, "heartbeat"); }, 2_000);
    s.heartbeatTimer = setInterval(() => { void this.sendCurrentPosition(tripId, "heartbeat"); }, interval);
    // Periodic stale recompute so status flips to "stale" without a new event.
    s.staleTimer = setInterval(() => this.recomputeStatus(tripId), 15_000);

    this.attachVisibility(tripId);
    this.recomputeStatus(tripId);
  }

  private detach(tripId: string): void {
    const s = this.trips.get(tripId);
    if (!s) return;
    if (s.watchId !== null && typeof navigator !== "undefined" && navigator.geolocation?.clearWatch) {
      try { navigator.geolocation.clearWatch(s.watchId); } catch { /* noop */ }
    }
    s.watchId = null;
    if (s.pollId !== null && typeof window !== "undefined") window.clearInterval(s.pollId);
    s.pollId = null;
    if (s.heartbeatInitial) clearTimeout(s.heartbeatInitial);
    if (s.heartbeatTimer) clearInterval(s.heartbeatTimer);
    if (s.staleTimer) clearInterval(s.staleTimer);
    s.heartbeatInitial = null;
    s.heartbeatTimer = null;
    s.staleTimer = null;
    this.detachVisibility(tripId);
    this.updateDebug(tripId, {
      watchStarted: false,
      watchId: null,
      watchIdExists: false,
      heartbeatIntervalActive: false,
      pollingActive: false,
      canSendImmediate: false,
    });
  }

  private attachVisibility(tripId: string): void {
    if (typeof document === "undefined") return;
    const s = this.trips.get(tripId);
    if (!s || s.visibilityHandler) return;

    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void>; addEventListener?: (e: string, cb: () => void) => void } | null> }
        };
        if (!nav.wakeLock?.request) return;
        const lock = await nav.wakeLock.request("screen");
        if (!lock) return;
        s.wakeLock = lock;
        this.updateDebug(tripId, { wakeLockActive: true });
        lock.addEventListener?.("release", () => this.updateDebug(tripId, { wakeLockActive: false }));
      } catch (e) { console.warn("[live:web] wakeLock failed", e); }
    };
    const releaseWakeLock = async () => {
      const lock = s.wakeLock;
      s.wakeLock = null;
      if (!lock) return;
      try { await lock.release(); } catch { /* noop */ }
      this.updateDebug(tripId, { wakeLockActive: false });
    };

    const handler = () => {
      const now = new Date().toISOString();
      const vis = document.visibilityState === "hidden" ? "hidden" : "visible";
      this.updateDebug(tripId, { pageVisibility: vis, lastVisibilityChangeTime: now });
      if (vis === "visible") {
        void requestWakeLock();
        if (typeof navigator !== "undefined" && navigator.geolocation?.getCurrentPosition) {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              this.ingestGpsFix(tripId, "poll", p);
              this.updateDebug(tripId, { lastResumeSendTime: new Date().toISOString() });
            },
            (err) => console.warn("[live:web] resume getCurrentPosition failed", err?.message),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
          );
        }
      } else {
        void releaseWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handler);
    s.visibilityHandler = handler;
    this.updateDebug(tripId, {
      pageVisibility: document.visibilityState === "hidden" ? "hidden" : "visible",
    });
    if (document.visibilityState !== "hidden") void requestWakeLock();
  }

  private detachVisibility(tripId: string): void {
    if (typeof document === "undefined") return;
    const s = this.trips.get(tripId);
    if (!s) return;
    if (s.visibilityHandler) {
      document.removeEventListener("visibilitychange", s.visibilityHandler);
      s.visibilityHandler = null;
    }
    if (s.wakeLock) {
      const lock = s.wakeLock;
      s.wakeLock = null;
      void lock.release().catch(() => {});
      this.updateDebug(tripId, { wakeLockActive: false });
    }
  }
}
