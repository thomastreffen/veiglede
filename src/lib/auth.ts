import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

type QueryCacheHandle = { cancelQueries: () => Promise<unknown>; clear: () => void };

let cache: AuthState = { user: null, session: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;

function notify() { listeners.forEach((l) => l()); }

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  // Initial session
  supabase.auth.getSession().then(({ data }) => {
    if (!cache.loading) return;
    cache = { user: data.session?.user ?? null, session: data.session, loading: false };
    notify();
  });
  // Listen to changes
  supabase.auth.onAuthStateChange((_event, session) => {
    cache = { user: session?.user ?? null, session, loading: false };
    notify();
  });
}

export function useAuth(): AuthState {
  init();
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return cache;
}

export function getAuthSnapshot(): AuthState { return cache; }

export async function signOut() {
  // 1. Stop every active live broadcaster immediately — no more
  //    background publishing after the user signs out.
  try {
    const { getLiveBroadcaster } = await import("@/lib/live/factory");
    await getLiveBroadcaster().stopAll();
  } catch { /* ignore — best effort */ }

  // 2. Clear local live opt-ins so the next signed-in user doesn't inherit
  //    them, and so GlobalLiveDriver doesn't try to restart them mid-logout.
  try {
    const { clearAllLiveOptIns } = await import("@/lib/live-tracking");
    clearAllLiveOptIns();
  } catch { /* ignore */ }

  // 3. Stop sync before wiping local state. This cancels pending debounced
  //    pushes/pulls so an old trips blob cannot be written back during logout.
  try {
    const { stopCloudSyncForLogout } = await import("@/lib/cloud-sync");
    stopCloudSyncForLogout();
  } catch { /* ignore */ }

  // 4. Clear in-memory app/query state before ending the auth session so no
  //    protected data flashes while the auth event propagates.
  try {
    const qc = typeof window !== "undefined"
      ? (window as unknown as { __veiglede_query_client?: QueryCacheHandle }).__veiglede_query_client
      : undefined;
    await qc?.cancelQueries();
    qc?.clear();
  } catch { /* ignore */ }

  try {
    const { clearTripsStateLocal } = await import("@/lib/trips-store");
    clearTripsStateLocal();
  } catch { /* ignore */ }

  // 5. End the backend session globally. Then update our local auth cache
  //    immediately; do not wait for the async auth-state listener.
  try { await supabase.auth.signOut({ scope: "global" }); } catch { try { await supabase.auth.signOut(); } catch { /* ignore */ } }
  cache = { user: null, session: null, loading: false };
  notify();

  // 6. Wipe all veiglede.* local/session storage keys (trips, tracking,
  //    drafts, prefs) so private content stops rendering immediately. Keep
  //    only visual theme + cross-session notices.
  if (typeof window !== "undefined") {
    try {
      const PRESERVE = new Set(["veiglede.theme"]);
      const isPreserved = (k: string) =>
        PRESERVE.has(k) || k.startsWith("veiglede.notice.");
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("veiglede.") && !isPreserved(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("veiglede.") && !isPreserved(k)) sessionStorage.removeItem(k);
      }
    } catch { /* ignore */ }

    // 7. Hard redirect to the login page. A full reload also
    //    drops any in-memory cached private state (TanStack Query cache,
    //    module-level singletons, etc.) so nothing stale lingers.
    window.location.replace("/login");
  }
}
