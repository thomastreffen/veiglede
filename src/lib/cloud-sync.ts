import { supabase } from "@/integrations/supabase/client";

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

let installed = false;
let currentUserId: string | null = null;
const debounce: Record<string, ReturnType<typeof setTimeout> | undefined> = {};

function fireStorageReload() {
  // Custom event our stores can listen to — but simpler: reload the page on first sync
  // so all useSyncExternalStore consumers pick up fresh data.
  window.dispatchEvent(new Event("veiglede:cloud-sync"));
}

async function pullAll(userId: string) {
  const [prefsRes, vehiclesRes, tripsRes] = await Promise.all([
    supabase.from("driver_prefs").select("data").eq("user_id", userId).maybeSingle(),
    supabase.from("vehicles").select("data").eq("id", userId).maybeSingle(),
    supabase.from("trips").select("data").eq("id", userId).maybeSingle(),
  ]);

  let didWrite = false;
  if (prefsRes.data?.data) {
    localStorage.setItem(KEYS.prefs, JSON.stringify(prefsRes.data.data));
    didWrite = true;
  } else if (localStorage.getItem(KEYS.prefs)) {
    void pushKey(KEYS.prefs, localStorage.getItem(KEYS.prefs)!);
  }
  if (vehiclesRes.data?.data) {
    localStorage.setItem(KEYS.vehicles, JSON.stringify(vehiclesRes.data.data));
    didWrite = true;
  } else if (localStorage.getItem(KEYS.vehicles)) {
    void pushKey(KEYS.vehicles, localStorage.getItem(KEYS.vehicles)!);
  }
  if (tripsRes.data?.data) {
    localStorage.setItem(KEYS.trips, JSON.stringify(tripsRes.data.data));
    didWrite = true;
  } else if (localStorage.getItem(KEYS.trips)) {
    void pushKey(KEYS.trips, localStorage.getItem(KEYS.trips)!);
  }

  if (didWrite) fireStorageReload();
}

async function pushKey(key: string, raw: string) {
  if (!currentUserId) return;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return; }
  try {
    if (key === KEYS.prefs) {
      await supabase.from("driver_prefs").upsert({
        user_id: currentUserId,
        data: data as any,
        updated_at: new Date().toISOString(),
      });
    } else if (key === KEYS.vehicles) {
      await supabase.from("vehicles").upsert({
        id: currentUserId,
        user_id: currentUserId,
        data: data as any,
        updated_at: new Date().toISOString(),
      });
    } else if (key === KEYS.trips) {
      await supabase.from("trips").upsert({
        id: currentUserId,
        user_id: currentUserId,
        data: data as any,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn("[cloud-sync] push failed", e);
  }
}

function wrapLocalStorage() {
  const orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    orig(key, value);
    if (!currentUserId) return;
    if (key !== KEYS.prefs && key !== KEYS.vehicles && key !== KEYS.trips) return;
    if (debounce[key]) clearTimeout(debounce[key]);
    debounce[key] = setTimeout(() => pushKey(key, value), 800);
  };
}

/**
 * Push the latest trips blob to Supabase immediately, bypassing the 800ms
 * debounce. Use right after generating/toggling share tokens so the public
 * `/shared/{token}` link works as soon as it's copied.
 */
export async function flushTripsNow(): Promise<void> {
  if (typeof window === "undefined" || !currentUserId) return;
  const raw = localStorage.getItem(KEYS.trips);
  if (!raw) return;
  if (debounce[KEYS.trips]) {
    clearTimeout(debounce[KEYS.trips]);
    debounce[KEYS.trips] = undefined;
  }
  await pushKey(KEYS.trips, raw);
}


export function startCloudSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  wrapLocalStorage();

  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      currentUserId = data.session.user.id;
      void pullAll(currentUserId);
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      const uid = session?.user?.id ?? null;
      if (uid && uid !== currentUserId) {
        currentUserId = uid;
        void pullAll(uid);
      } else {
        currentUserId = uid;
      }
    } else if (event === "SIGNED_OUT") {
      currentUserId = null;
      // Keep local demo data so user can keep exploring as guest.
    }
  });
}
