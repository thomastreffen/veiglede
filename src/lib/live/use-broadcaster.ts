// React adapter around the singleton LiveBroadcaster.
//
// IMPORTANT: This hook is now READ-ONLY. Lifecycle (start/stop/update) is
// owned by <GlobalLiveDriver /> (mounted once in AppShell) so that the
// broadcaster survives internal navigation between trip subpages, /home,
// /garage, /settings, etc. Mount/unmount of trip UI must NEVER start or
// stop publishing — only explicit user action ("Stopp live-deling"),
// trip completion, or logout should.
import { useEffect, useState } from "react";
import { getLiveBroadcaster } from "./factory";
import type { BroadcastSnapshot } from "./types";
import type { LiveBroadcasterDebugState, LiveStatus } from "@/lib/live-tracking";

export interface UseLiveBroadcasterArgs {
  tripId: string;
  userId?: string | null | undefined;
  enabled?: boolean;
  status?: LiveStatus | "idle";
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
  const { tripId } = args;
  const broadcaster = getLiveBroadcaster();
  const [snapshot, setSnapshot] = useState<BroadcastSnapshot>(() => broadcaster.getStatus(tripId));

  useEffect(() => {
    const unsub = broadcaster.subscribeStatus(tripId, setSnapshot);
    return () => { unsub(); };
  }, [broadcaster, tripId]);

  return {
    snapshot,
    debug: snapshot.debug ?? FALLBACK_DEBUG,
    sendTestPositionNow: () => broadcaster.sendNow(tripId),
  };
}
