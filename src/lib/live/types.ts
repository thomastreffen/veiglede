// LiveBroadcaster public contract — shared by web and (future) native impls.
import type {
  LivePosition,
  LiveStatus,
  LiveBroadcasterDebugState,
} from "@/lib/live-tracking";

export type BroadcastStatus =
  | "idle"
  | "starting"
  | "broadcasting"
  | "paused"
  | "stale"
  | "error"
  | "stopped";

export interface BroadcastSnapshot {
  status: BroadcastStatus;
  tripId: string | null;
  lastSentAt: string | null;
  lastPosition: LivePosition | null;
  errorMessage: string | null;
  /** Optional rich state for debug surfaces (web impl populates this). */
  debug?: LiveBroadcasterDebugState;
}

export interface StartOptions {
  userId: string;
  /** Current trip lifecycle status from trip-tracking. */
  tripStatus: LiveStatus | "idle";
  lastStopName?: string | null;
  intervalMs?: number;
}

export interface PositionPublishedEvent {
  tripId: string;
  position: LivePosition;
  at: string;
}

export type StatusListener = (snapshot: BroadcastSnapshot) => void;
export type PositionListener = (event: PositionPublishedEvent) => void;
export type Unsubscribe = () => void;

export interface LiveBroadcaster {
  readonly kind: "web" | "native";

  start(tripId: string, options: StartOptions): Promise<void>;
  stop(tripId: string): Promise<void>;

  /** Update mutable inputs without restarting the broadcaster. */
  update(tripId: string, patch: Partial<StartOptions>): void;

  getStatus(tripId: string): BroadcastSnapshot;

  subscribeStatus(tripId: string, cb: StatusListener): Unsubscribe;
  subscribePositionPublished(tripId: string, cb: PositionListener): Unsubscribe;

  /** Force an immediate send of the last known position (manual / test). */
  sendNow(tripId: string): Promise<boolean>;
}

export function emptySnapshot(tripId: string | null = null): BroadcastSnapshot {
  return {
    status: "idle",
    tripId,
    lastSentAt: null,
    lastPosition: null,
    errorMessage: null,
  };
}
