// NativeLiveBroadcaster — placeholder for a future Capacitor-backed
// implementation (e.g. @transistorsoft/capacitor-background-geolocation).
// Today this is never selected (see factory + platform.ts), and returns
// an "error" snapshot if invoked, so missing native support is loud and clear.
import {
  emptySnapshot,
  type BroadcastSnapshot,
  type LiveBroadcaster,
  type PositionListener,
  type StartOptions,
  type StatusListener,
  type Unsubscribe,
} from "./types";

const NOT_IMPLEMENTED = "Native live broadcaster is not implemented yet.";

export class NativeLiveBroadcaster implements LiveBroadcaster {
  readonly kind = "native" as const;

  async start(tripId: string, _options: StartOptions): Promise<void> {
    void _options;
    console.warn(`[live:native] start(${tripId}) — ${NOT_IMPLEMENTED}`);
  }
  async stop(_tripId: string): Promise<void> { /* noop */ }
  update(_tripId: string, _patch: Partial<StartOptions>): void { /* noop */ }

  getStatus(tripId: string): BroadcastSnapshot {
    return { ...emptySnapshot(tripId), status: "error", errorMessage: NOT_IMPLEMENTED };
  }

  subscribeStatus(tripId: string, cb: StatusListener): Unsubscribe {
    try { cb(this.getStatus(tripId)); } catch { /* noop */ }
    return () => {};
  }
  subscribePositionPublished(_tripId: string, _cb: PositionListener): Unsubscribe {
    return () => {};
  }
  async sendNow(_tripId: string): Promise<boolean> { return false; }
}
