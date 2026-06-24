import { supabase } from "@/integrations/supabase/client";
import { getTripsStorageKey, mergeTripsStatesForSync, normalizeTripsState, replaceTripsStateFromSync } from "@/lib/trips-store";

/**
 * Demo-data in localStorage <-> Lovable Cloud sync.
 *
 * We store each store's entire state as a single jsonb row keyed by user_id.
 * - veiglede.profile.v1   -> driver_prefs(user_id, data)
 * - veiglede.vehicles.v1  -> vehicles(id=user_id, data)
 * - veiglede.v4 (trips)   -> trips(id=user_id, data)
 *
 * On SIGNED_IN: pull cloud data and write to localStorage. If cloud is empty
 * and local has demo data, push local up (auto-migrate the demo trip).
 * After that, every localStorage.setItem on tracked keys is debounced and
 * pushed to the cloud.
 */

const KEYS = {
  prefs: "veiglede.profile.v1",
  vehicles: "veiglede.vehicles.v2",
  trips: "veiglede.v4",
  language: "veiglede.language",
} as const;

type SyncDirection = "idle" | "pull" | "push" | "delete" | "skip" | "logout";

interface SyncDebugState {
  pulling: boolean;
  pendingPushKeys: string[];
  lastDirection: SyncDirection;
  lastAt?: string;
  lastReason?: string;
  cloudTripsCount?: number;
  cloudTripsRevision?: number;
  cloudTripsUpdatedAt?: number;
}

let installed = false;
let currentUserId: string | null = null;
let pulling = false;
let syncReady = false;
let syncGeneration = 0;
let suspended = false;
const readyListeners = new Set<() => void>();
const debounce: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
const debugState: SyncDebugState = { pulling: false, pendingPushKeys: [], lastDirection: "idle" };

function setDebug(direction: SyncDirection, reason?: string, extra: Partial<SyncDebugState> = {}) {
  Object.assign(debugState, extra, {
    lastDirection: direction,
    lastReason: reason,
    lastAt: new Date().toISOString(),
    pulling,
    pendingPushKeys: Object.entries(debounce).filter(([, v]) => !!v).map(([k]) => k),
  });
  if (typeof window !== "undefined") {
    (window as unknown as { __veiglede_sync_debug?: SyncDebugState }).__veiglede_sync_debug = { ...debugState };
    window.dispatchEvent(new Event("veiglede:sync-debug"));
  }
}

function fireStorageReload() {
  window.dispatchEvent(new Event("veiglede:cloud-sync"));
}

function setReady(v: boolean) {
  if (syncReady === v) return;
  syncReady = v;
  readyListeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("veiglede:cloud-sync-ready"));
  }
}

export function isCloudSyncReady() { return syncReady; }
export function onCloudSyncReady(l: () => void) {
  readyListeners.add(l);
  return () => readyListeners.delete(l);
}
export function getCurrentSyncUserId() { return currentUserId; }
export function getCloudSyncDebugSnapshot(): SyncDebugState & { currentUserId: string | null; ready: boolean } {
  return { ...debugState, currentUserId, ready: syncReady, pulling };
}

/** Parse a trips blob string and return how many trips it represents. */
function tripsCount(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.trips)) return parsed.trips.length;
  } catch {}
  return 0;
}

async function pullAll(userId: string) {
  if (pulling) { setReady(true); return; }
  if (suspended) return;
  const generation = syncGeneration;
  pulling = true;
  setDebug("pull", "start");
  try {
    const [prefsRes, vehiclesRes, tripsRes, profileRes] = await Promise.all([
      supabase.from("driver_prefs").select("data").eq("user_id", userId).maybeSingle(),
      supabase.from("vehicles").select("data").eq("id", userId).maybeSingle(),
      supabase.from("trips").select("data").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("language").eq("id", userId).maybeSingle(),
    ]);

    let didWrite = false;
    if (prefsRes.data?.data) {
      localStorage.setItem(KEYS.prefs, JSON.stringify(prefsRes.data.data));
      didWrite = true;
    } else if (!prefsRes.error && localStorage.getItem(KEYS.prefs)) {
      void pushKey(KEYS.prefs, localStorage.getItem(KEYS.prefs)!);
    }
    if (vehiclesRes.data?.data) {
      localStorage.setItem(KEYS.vehicles, JSON.stringify(vehiclesRes.data.data));
      didWrite = true;
    } else if (!vehiclesRes.error && localStorage.getItem(KEYS.vehicles)) {
      void pushKey(KEYS.vehicles, localStorage.getItem(KEYS.vehicles)!);
    }
    if (generation !== syncGeneration || userId !== currentUserId || suspended) return;

    if (tripsRes.data?.data) {
      const localRaw = localStorage.getItem(KEYS.trips);
      const cloudState = normalizeTripsState(tripsRes.data.data);
      const localState = localRaw ? normalizeTripsState(JSON.parse(localRaw)) : normalizeTripsState(null);
      const merged = mergeTripsStatesForSync(localState, cloudState);
      const mergedRaw = JSON.stringify(merged);
      replaceTripsStateFromSync(merged);
      didWrite = true;
      setDebug("pull", "merged trips", {
        cloudTripsCount: cloudState.trips.length,
        cloudTripsRevision: cloudState.revision,
        cloudTripsUpdatedAt: cloudState.updatedAt,
      });
      // If merge chose local tombstones/newer local content, immediately repair
      // the cloud row so another device cannot resurrect stale trips.
      if (mergedRaw !== JSON.stringify(cloudState)) {
        await pushKey(KEYS.trips, mergedRaw, "pull-merge-repair");
      }
    } else if (!tripsRes.error) {
      // CRITICAL: never push an empty/seed blob up — it would clobber a row
      // that simply failed to fetch on this device. Only push local trips
      // when there is actual content to preserve.
      const localRaw = localStorage.getItem(KEYS.trips);
      if (localRaw) {
        const localState = normalizeTripsState(JSON.parse(localRaw));
        // First login / no cloud row: push only if local data exists. An empty
        // or tombstone-only blob must not create stale cloud content.
        if (localState.trips.length > 0) {
          void pushKey(KEYS.trips, JSON.stringify(localState), "bootstrap-local");
        }
      }
    }

    const cloudLang = (profileRes.data as { language?: string } | null)?.language;
    if (cloudLang) {
      const prev = localStorage.getItem(KEYS.language);
      if (prev !== cloudLang) {
        localStorage.setItem(KEYS.language, cloudLang);
        didWrite = true;
      }
    } else {
      const localLang = localStorage.getItem(KEYS.language);
      if (localLang) void pushKey(KEYS.language, localLang, "language-bootstrap");
    }

    if (didWrite) fireStorageReload();
  } catch (e) {
    console.warn("[cloud-sync] pull failed", e);
    setDebug("pull", "failed");
  } finally {
    pulling = false;
    setDebug("pull", "done");
    setReady(true);
    // Always fire so late-mounted stores can re-read (event may have raced).
    fireStorageReload();
  }
}

/** Force a re-pull from cloud for the current user (e.g. on /trips mount). */
export async function refreshCloudData(): Promise<void> {
  if (typeof window === "undefined" || !currentUserId) return;
  if (suspended) return;
  await pullAll(currentUserId);
}

async function pushKey(key: string, raw: string, reason = "debounce") {
  if (!currentUserId || suspended) return;
  const userId = currentUserId;
  const generation = syncGeneration;
  // Guard: skip push if payload exceeds 4MB to avoid Supabase jsonb limits
  if (raw.length > 4 * 1024 * 1024) {
    console.warn("[cloud-sync] payload too large, skipping push for key:", key, `(${raw.length} bytes)`);
    return;
  }
  try {
    if (key === KEYS.language) {
      await supabase
        .from("profiles")
        .upsert({ id: userId, language: raw, updated_at: new Date().toISOString() });
      setDebug("push", reason);
      return;
    }
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return; }
    if (generation !== syncGeneration || userId !== currentUserId || suspended) {
      setDebug("skip", "stale push cancelled");
      return;
    }
    if (key === KEYS.prefs) {
      await supabase.from("driver_prefs").upsert({
        user_id: userId,
        data: data as any,
        updated_at: new Date().toISOString(),
      });
    } else if (key === KEYS.vehicles) {
      await supabase.from("vehicles").upsert({
        id: userId,
        user_id: userId,
        data: data as any,
        updated_at: new Date().toISOString(),
      });
    } else if (key === KEYS.trips) {
      const localState = normalizeTripsState(data);
      await supabase.from("trips").upsert({
        id: userId,
        user_id: userId,
        data: localState as any,
        updated_at: new Date().toISOString(),
      });
      setDebug(reason === "deleteTrip" ? "delete" : "push", reason, {
        cloudTripsCount: localState.trips.length,
        cloudTripsRevision: localState.revision,
        cloudTripsUpdatedAt: localState.updatedAt,
      });
    }
  } catch (e) {
    console.warn("[cloud-sync] push failed", e);
    setDebug("push", "failed");
  }
}

function wrapLocalStorage() {
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    orig(key, value);
    if (!currentUserId || suspended || pulling) return;
    if (
      key !== KEYS.prefs &&
      key !== KEYS.vehicles &&
      key !== KEYS.trips &&
      key !== KEYS.language
    )
      return;
    if (debounce[key]) clearTimeout(debounce[key]);
    debounce[key] = setTimeout(() => pushKey(key, value, "debounce"), 800);
    setDebug("push", "scheduled");
  };
}

/**
 * Push the latest trips blob to Supabase immediately, bypassing the 800ms
 * debounce. Use right after generating/toggling share tokens so the public
 * `/shared/{token}` link works as soon as it's copied.
 */
export async function flushTripsNow(reason = "flush"): Promise<void> {
  if (typeof window === "undefined" || !currentUserId) return;
  if (reason === "deleteTrip") syncGeneration += 1;
  const raw = localStorage.getItem(getTripsStorageKey());
  if (!raw) return;
  if (debounce[KEYS.trips]) {
    clearTimeout(debounce[KEYS.trips]);
    debounce[KEYS.trips] = undefined;
  }
  await pushKey(KEYS.trips, raw, reason);
}

export function stopCloudSyncForLogout() {
  suspended = true;
  syncGeneration += 1;
  currentUserId = null;
  pulling = false;
  for (const key of Object.keys(debounce)) {
    if (debounce[key]) clearTimeout(debounce[key]);
    debounce[key] = undefined;
  }
  setReady(true);
  setDebug("logout", "stopped");
}


export function startCloudSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  suspended = false;
  wrapLocalStorage();

  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      currentUserId = data.session.user.id;
      suspended = false;
      void pullAll(currentUserId);
    } else {
      // No signed-in user; mark sync ready so guests don't sit in a spinner.
      setReady(true);
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN") {
      const uid = session?.user?.id ?? null;
      if (uid && uid !== currentUserId) {
        syncGeneration += 1;
        suspended = false;
        currentUserId = uid;
        setReady(false);
        void pullAll(uid);
      } else {
        currentUserId = uid;
      }
    } else if (event === "TOKEN_REFRESHED") {
      currentUserId = session?.user?.id ?? currentUserId;
    } else if (event === "SIGNED_OUT") {
      syncGeneration += 1;
      currentUserId = null;
      setReady(true);
      for (const key of Object.keys(debounce)) {
        if (debounce[key]) clearTimeout(debounce[key]);
        debounce[key] = undefined;
      }
      setDebug("logout", "auth event");
    }
  });
}
