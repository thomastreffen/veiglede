// App-level live broadcaster driver. Mounted once in AppShell.
//
// Why app-level: previously the lifecycle (start/stop/update) of the
// WebLiveBroadcaster was driven by the TripTracker component's mount.
// That made publishing fragile — leaving the trip page (e.g. navigating
// to /home or /garage) unmounted the only thing telling the broadcaster
// to keep going, so the public follower page would receive nothing until
// the driver came back to the trip window.
//
// Now: as long as the user is signed in AND any trip has the live opt-in
// flag set AND it is not completed, the broadcaster keeps running here,
// regardless of which route is currently displayed. The trip page UI only
// reads status from the broadcaster (read-only adapter hook). Explicit
// "Stopp live-deling", completing the trip, or logout are the only ways
// publishing ends.
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLiveOptInTripIds } from "@/lib/live-tracking";
import { getLiveBroadcaster } from "@/lib/live/factory";
import { getTracking } from "@/lib/trip-tracking";

export function GlobalLiveDriver() {
  const { user } = useAuth();
  const optedInIds = useLiveOptInTripIds();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const broadcaster = getLiveBroadcaster();
    const uid = user?.id ?? null;

    const sync = () => {
      const wantedIds = new Set(optedInIds);
      // Drive each opted-in trip.
      if (uid) {
        for (const tripId of wantedIds) {
          const t = getTracking(tripId);
          // Publish while active/paused (status that the public live view
          // treats as "live"). "completed" → stop. "idle" → don't broadcast
          // yet (user hasn't started the trip; the broadcaster would just
          // sit in "starting" with no useful position).
          if (t.status === "completed") {
            void broadcaster.stop(tripId);
            continue;
          }
          if (t.status === "idle") {
            // Live opt-in is on but the trip hasn't started yet. Don't
            // publish anything — the broadcaster only sends "active" or
            // "paused". Once the user taps Start tur, the next sync tick
            // will start broadcasting.
            void broadcaster.stop(tripId);
            continue;
          }
          void broadcaster.start(tripId, { userId: uid, tripStatus: t.status });
        }
      }
      // Stop any active trips that are no longer opted in OR no longer
      // belong to the current user.
      const snapshot = broadcaster as unknown as {
        // Best-effort introspection. Falls back to a no-op when the impl
        // doesn't expose internals (e.g. NativeLiveBroadcaster stub).
        trips?: Map<string, unknown>;
      };
      const knownIds = snapshot.trips instanceof Map ? Array.from(snapshot.trips.keys()) : [];
      for (const id of knownIds) {
        if (!wantedIds.has(id) || !uid) {
          void broadcaster.stop(id);
        }
      }
    };

    sync();
    // Tracking status changes are stored in localStorage and dispatch a
    // synthetic event from trip-tracking; we also resync on storage events
    // for cross-tab safety.
    const handler = () => sync();
    window.addEventListener("storage", handler);
    // Lightweight poll for in-tab tracking changes (trip-tracking uses
    // useSyncExternalStore listeners but doesn't dispatch a window event).
    const poll = window.setInterval(sync, 2_000);
    return () => {
      window.removeEventListener("storage", handler);
      window.clearInterval(poll);
    };
  }, [user?.id, optedInIds]);

  return null;
}
