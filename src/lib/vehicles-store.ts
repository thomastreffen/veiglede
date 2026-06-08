import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { VehicleType, RouteStyle, StopType, EnergySource } from "./trips-store";


export type EnergyType =
  | "petrol"
  | "diesel"
  | "electric"
  | "hybrid-petrol"
  | "hybrid-diesel"
  /** Legacy generic hybrid — kept for back-compat with seeded trips. */
  | "hybrid"
  | "other";

/** Coarse fuel kind used to drive UX (search categories, AI prompts, costs). */
export type FuelKind = "petrol" | "diesel" | "electric" | "hybrid" | "other";

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  energy: EnergyType;
  photo?: string; // data URL
  defaultStyle: RouteStyle;
  drivingFlags: Record<string, boolean>;
  stopInterests: StopType[];
  /** Whether this vehicle appears on the user's public profile. Defaults to true. */
  isPublic?: boolean;
  isDemo?: boolean;
  hint?: string;
}

export const ENERGIES: { value: EnergyType; label: string; emoji: string }[] = [
  { value: "petrol",         label: "Bensin",          emoji: "⛽" },
  { value: "diesel",         label: "Diesel",          emoji: "🛢️" },
  { value: "electric",       label: "Elektrisk",       emoji: "⚡" },
  { value: "hybrid-petrol",  label: "Hybrid (bensin)", emoji: "🔋" },
  { value: "hybrid-diesel",  label: "Hybrid (diesel)", emoji: "🔋" },
  { value: "other",          label: "Annet",           emoji: "🚲" },
];

export function energyMeta(e: EnergyType) {
  // Legacy "hybrid" maps to the petrol-hybrid label for display.
  if (e === "hybrid") return { value: "hybrid" as EnergyType, label: "Hybrid", emoji: "🔋" };
  return ENERGIES.find((x) => x.value === e) ?? ENERGIES[0];
}

/** Map any EnergyType to the coarse FuelKind that downstream UX cares about. */
export function fuelKindOf(e: EnergyType | undefined): FuelKind {
  switch (e) {
    case "electric": return "electric";
    case "diesel": return "diesel";
    case "petrol": return "petrol";
    case "hybrid":
    case "hybrid-petrol":
    case "hybrid-diesel": return "hybrid";
    case "other": return "other";
    default: return "petrol";
  }
}

/** Narrow EnergyType back into the EnergySource union persisted on a Trip. */
export function energyTypeToSource(e: EnergyType | undefined): EnergySource | undefined {
  if (!e) return undefined;
  if (e === "petrol" || e === "diesel" || e === "electric") return e;
  if (e === "other") return undefined;
  return "hybrid"; // hybrid, hybrid-petrol, hybrid-diesel
}



export function defaultsFor(type: VehicleType, energy: EnergyType): {
  defaultStyle: RouteStyle;
  drivingFlags: Record<string, boolean>;
  stopInterests: StopType[];
} {
  if (type === "motorcycle") {
    return {
      defaultStyle: "curvy",
      drivingFlags: { curvy: true, views: true, photo: true, tourist: true, "no-highway": true, food: true },
      stopInterests: ["viewpoint", "photo", "food", "experience", "rest", energy === "electric" ? "fuel" : "fuel"],
    };
  }
  if (type === "rv") {
    return {
      defaultStyle: "cruise",
      drivingFlags: { cruise: true, views: true, food: true, "no-highway": true },
      stopInterests: ["lodging", "detour", "food", "viewpoint", "rest"],
    };
  }
  // car
  if (energy === "electric") {
    return {
      defaultStyle: "scenic",
      drivingFlags: { views: true, food: true, tourist: true, charging: true },
      stopInterests: ["fuel", "food", "viewpoint", "attraction", "lodging"],
    };
  }
  return {
    defaultStyle: "scenic",
    drivingFlags: { views: true, food: true, tourist: true },
    stopInterests: ["food", "viewpoint", "attraction", "experience"],
  };
}

interface State { vehicles: Vehicle[]; defaultId: string }

function uid() { return Math.random().toString(36).slice(2, 10); }

function seed(): State {
  // New users start with a clean garage — no demo vehicles.
  return { vehicles: [], defaultId: "" };
}

const KEY = "veiglede.vehicles.v2";
const listeners = new Set<() => void>();
let cache: State | null = null;

function load(): State {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    const parsed = JSON.parse(raw) as State;
    if (!parsed.vehicles?.length) return seed();
    return parsed;
  } catch { return seed(); }
}

function persist(next: State) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        toast.error("Kunne ikke lagre — prøv et mindre bilde");
      }
      throw e;
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
let cloudSyncBound = false;
function getSnapshot(): State {
  if (!cache) cache = load();
  if (!cloudSyncBound && typeof window !== "undefined") {
    cloudSyncBound = true;
    window.addEventListener("veiglede:cloud-sync", () => {
      cache = load();
      listeners.forEach((l) => l());
    });
  }
  return cache;
}
function getServerSnapshot(): State { return seed(); }

export function useVehicles() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDefaultVehicle(): Vehicle {
  const { vehicles, defaultId } = useVehicles();
  return vehicles.find((v) => v.id === defaultId) ?? vehicles[0];
}

export function getVehicleById(id: string | undefined): Vehicle | undefined {
  if (!id) return undefined;
  return getSnapshot().vehicles.find((v) => v.id === id);
}

export const vehiclesApi = {
  add(input: Omit<Vehicle, "id">): Vehicle {
    const v: Vehicle = { ...input, id: uid() };
    const cur = getSnapshot();
    const defaultId = cur.defaultId || v.id;
    persist({ vehicles: [...cur.vehicles, v], defaultId });
    return v;
  },
  update(id: string, patch: Partial<Vehicle>) {
    const cur = getSnapshot();
    persist({ ...cur, vehicles: cur.vehicles.map((v) => v.id === id ? { ...v, ...patch } : v) });
  },
  remove(id: string) {
    const cur = getSnapshot();
    const next = cur.vehicles.filter((v) => v.id !== id);
    const defaultId = cur.defaultId === id ? (next[0]?.id ?? "") : cur.defaultId;
    persist({ vehicles: next, defaultId });
  },
  setDefault(id: string) {
    const cur = getSnapshot();
    persist({ ...cur, defaultId: id });
  },
  toggleFlag(id: string, key: string) {
    const v = getSnapshot().vehicles.find((x) => x.id === id);
    if (!v) return;
    this.update(id, { drivingFlags: { ...v.drivingFlags, [key]: !v.drivingFlags[key] } });
  },
  toggleInterest(id: string, t: StopType) {
    const v = getSnapshot().vehicles.find((x) => x.id === id);
    if (!v) return;
    const has = v.stopInterests.includes(t);
    this.update(id, { stopInterests: has ? v.stopInterests.filter((x) => x !== t) : [...v.stopInterests, t] });
  },
};
