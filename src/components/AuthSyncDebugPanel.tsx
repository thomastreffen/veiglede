import { useEffect, useState } from "react";

import { useDebugMode } from "@/components/DemoDebugPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getCloudSyncDebugSnapshot } from "@/lib/cloud-sync";
import { getTripsDebugSnapshot } from "@/lib/trips-store";

type Snapshot = ReturnType<typeof getTripsDebugSnapshot> & {
  authLoading: boolean;
  authUserId: string | null;
  hasSession: boolean;
  currentSyncUserId: string | null;
  syncReady: boolean;
  syncPulling: boolean;
  pendingPushKeys: string[];
  lastSyncDirection: string;
  lastSyncReason?: string;
  cloudTripsCount?: number;
};

export function AuthSyncDebugPanel() {
  const debug = useDebugMode();
  const auth = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!debug) return;
    let cancelled = false;
    const read = async () => {
      const trips = getTripsDebugSnapshot();
      const sync = getCloudSyncDebugSnapshot();
      let cloudTripsCount = sync.cloudTripsCount;
      if (auth.user) {
        try {
          const { data } = await supabase.from("trips").select("data").eq("user_id", auth.user.id).maybeSingle();
          const cloudData = data?.data as { trips?: unknown[] } | undefined;
          cloudTripsCount = Array.isArray(cloudData?.trips) ? cloudData.trips.length : 0;
        } catch { /* debug only */ }
      }
      if (cancelled) return;
      setSnapshot({
        ...trips,
        authLoading: auth.loading,
        authUserId: auth.user?.id ?? null,
        hasSession: !!auth.session,
        currentSyncUserId: sync.currentUserId,
        syncReady: sync.ready,
        syncPulling: sync.pulling,
        pendingPushKeys: sync.pendingPushKeys,
        lastSyncDirection: sync.lastDirection,
        lastSyncReason: sync.lastReason,
        cloudTripsCount,
      });
    };
    void read();
    const onChange = () => void read();
    window.addEventListener("veiglede:cloud-sync", onChange);
    window.addEventListener("veiglede:cloud-sync-ready", onChange);
    window.addEventListener("veiglede:sync-debug", onChange);
    window.addEventListener("storage", onChange);
    const interval = window.setInterval(onChange, 2500);
    return () => {
      cancelled = true;
      window.removeEventListener("veiglede:cloud-sync", onChange);
      window.removeEventListener("veiglede:cloud-sync-ready", onChange);
      window.removeEventListener("veiglede:sync-debug", onChange);
      window.removeEventListener("storage", onChange);
      window.clearInterval(interval);
    };
  }, [debug, auth.loading, auth.user, auth.session]);

  if (!debug || !snapshot) return null;

  const updated = snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString("nb-NO") : "—";
  const items = [
    ["user", short(snapshot.authUserId)],
    ["session", snapshot.hasSession ? "yes" : "no"],
    ["auth loading", String(snapshot.authLoading)],
    ["sync user", short(snapshot.currentSyncUserId)],
    ["sync ready", String(snapshot.syncReady)],
    ["pulling", String(snapshot.syncPulling)],
    ["local trips", String(snapshot.tripsCount)],
    ["cloud trips", snapshot.cloudTripsCount == null ? "—" : String(snapshot.cloudTripsCount)],
    ["revision", String(snapshot.revision)],
    ["updated", updated],
    ["pending", snapshot.pendingPushKeys.length ? snapshot.pendingPushKeys.join(",") : "—"],
    ["last sync", `${snapshot.lastSyncDirection}${snapshot.lastSyncReason ? `/${snapshot.lastSyncReason}` : ""}`],
    ["last mutation", snapshot.lastMutation?.actionName ?? "—"],
    ["mutation trip", short(snapshot.lastMutation?.tripId ?? null)],
    ["deleted ids", String(snapshot.deletedTripIdsCount)],
  ];

  return (
    <aside className="fixed bottom-3 left-3 z-[80] max-w-[calc(100vw-1.5rem)] rounded-xl border border-primary/40 bg-background/95 p-3 text-[11px] shadow-xl backdrop-blur md:max-w-xl">
      <p className="font-semibold uppercase tracking-[0.22em] text-primary">Auth / sync debug</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <span className="text-muted-foreground">{label}: </span>
            <span className="font-mono text-foreground break-all">{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function short(v: string | null | undefined) {
  if (!v) return "—";
  return v.length > 10 ? `${v.slice(0, 8)}…` : v;
}