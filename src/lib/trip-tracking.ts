import { useSyncExternalStore } from "react";

export type TripStatus = "idle" | "active" | "paused" | "completed";

export interface TripTracking {
  status: TripStatus;
  startedAt?: number;
  pausedAt?: number;
  completedAt?: number;
  visitedStopIds: string[];
  spontaneousStops: { id: string; label: string; at: number }[];
  notes?: string;
  /** Accumulated driven distance (km) from live geolocation samples. */
  actualDistanceKm?: number;
}

type State = Record<string, TripTracking>;

const KEY = "veiglede.tracking.v1";
const DEFAULT: TripTracking = { status: "idle", visitedStopIds: [], spontaneousStops: [] };
const listeners = new Set<() => void>();
let cache: State | null = null;

function load(): State {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function snap(): State { if (!cache) cache = load(); return cache; }
function persist() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getServerSnapshot(): State { return {}; }

export function useTripTracking(tripId: string): TripTracking {
  const s = useSyncExternalStore(subscribe, snap, getServerSnapshot);
  return s[tripId] ?? DEFAULT;
}

function update(tripId: string, patch: Partial<TripTracking>) {
  const cur = snap();
  cache = { ...cur, [tripId]: { ...DEFAULT, ...cur[tripId], ...patch } };
  persist();
}

export const trackingApi = {
  start(tripId: string) {
    update(tripId, { status: "active", startedAt: Date.now(), completedAt: undefined });
  },
  pause(tripId: string) { update(tripId, { status: "paused", pausedAt: Date.now() }); },
  resume(tripId: string) { update(tripId, { status: "active" }); },
  complete(tripId: string) { update(tripId, { status: "completed", completedAt: Date.now() }); },
  reset(tripId: string) {
    const cur = snap();
    const { [tripId]: _, ...rest } = cur;
    cache = rest;
    persist();
  },
  toggleVisited(tripId: string, stopId: string) {
    const cur = snap()[tripId] ?? DEFAULT;
    const has = cur.visitedStopIds.includes(stopId);
    update(tripId, {
      visitedStopIds: has ? cur.visitedStopIds.filter((x) => x !== stopId) : [...cur.visitedStopIds, stopId],
    });
  },
  addSpontaneous(tripId: string, label: string) {
    const cur = snap()[tripId] ?? DEFAULT;
    update(tripId, {
      spontaneousStops: [...cur.spontaneousStops, { id: Math.random().toString(36).slice(2, 8), label, at: Date.now() }],
    });
  },
};

export function statusMeta(s: TripStatus) {
  switch (s) {
    case "idle": return { label: "Ikke startet", emoji: "○", cls: "border-border text-muted-foreground" };
    case "active": return { label: "På tur", emoji: "●", cls: "border-primary text-primary bg-primary/10" };
    case "paused": return { label: "Pauset", emoji: "❚❚", cls: "border-amber-500/60 text-amber-500 bg-amber-500/10" };
    case "completed": return { label: "Fullført", emoji: "✓", cls: "border-emerald-500/60 text-emerald-500 bg-emerald-500/10" };
  }
}
