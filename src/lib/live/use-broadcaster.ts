// React adapter around the singleton LiveBroadcaster. Owns no geolocation
// logic itself — that lives in WebLiveBroadcaster (and later
// NativeLiveBroadcaster). Trip UI consumes this hook only.
import { useEffect, useRef, useState } from "react";
import { getLiveBroadcaster } from "./factory";
import type { BroadcastSnapshot, StartOptions } from "./types";
import type { LiveBroadcasterDebugState, LiveStatus } from "@/lib/live-tracking";

export interface UseLiveBroadcasterArgs {
  tripId: string;
  userId: string | null | undefined;
  enabled: boolean;
  status: LiveStatus | "idle";
  lastStopName?: string | null;
  intervalMs?: number;
}

export interface UseLiveBroadcasterResult {
  snapshot: BroadcastSnapshot;
  debug: LiveBroadcasterDebugState;
  sendTestPositionNow: () => Promise<boolean>;
}

const FALLBACK_DEBUG: LiveBroadcasterDebugState = {
  broadcastable: false,
  liveOn: false,
  tripStatus: "idle",
  permissionState: "unknown",
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
  pageVisibility: "visible",
  lastVisibilityChangeTime: null,
  lastResumeSendTime: null,
  wakeLockActive: false,
};

export function useLiveBroadcasterAdapter(args: UseLiveBroadcasterArgs): UseLiveBroadcasterResult {
  const { tripId, userId, enabled, status, lastStopName, intervalMs } = args;
  const broadcaster = getLiveBroadcaster();
  const [snapshot, setSnapshot] = useState<BroadcastSnapshot>(() => broadcaster.getStatus(tripId));
  const startedRef = useRef(false);

  // Subscribe to status updates for this trip.
  useEffect(() => {
    const unsub = broadcaster.subscribeStatus(tripId, setSnapshot);
    return () => { unsub(); };
  }, [broadcaster, tripId]);

  // Drive lifecycle: start/stop when enabled+userId+status changes.
  useEffect(() => {
    if (!enabled || !userId) {
      if (startedRef.current) {
        startedRef.current = false;
        void broadcaster.stop(tripId);
      }
      return;
    }
    const opts: StartOptions = {
      userId,
      tripStatus: status,
      lastStopName: lastStopName ?? null,
      intervalMs,
    };
    if (!startedRef.current) {
      startedRef.current = true;
      void broadcaster.start(tripId, opts);
    } else {
      broadcaster.update(tripId, opts);
    }
  }, [broadcaster, enabled, userId, tripId, status, lastStopName, intervalMs]);

  // Stop on unmount only if this hook was the starter.
  useEffect(() => {
    return () => {
      if (startedRef.current) {
        startedRef.current = false;
        void broadcaster.stop(tripId);
      }
    };
  }, [broadcaster, tripId]);

  return {
    snapshot,
    debug: snapshot.debug ?? FALLBACK_DEBUG,
    sendTestPositionNow: () => broadcaster.sendNow(tripId),
  };
}
