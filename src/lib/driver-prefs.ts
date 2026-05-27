import { useSyncExternalStore } from "react";
import type { VehicleType, RouteStyle, StopType } from "./trips-store";

export interface DriverPrefs {
  displayName: string;
  units: "km" | "mi";
  language: "nb" | "en";
  defaultVehicle: VehicleType;
  defaultStyle: RouteStyle;
  drivingFlags: Record<string, boolean>;
  stopInterests: StopType[];
  maxDrivingHours: number;
  pauseEveryMin: number;
  sharing: {
    defaultPrivate: boolean;
    allowRoadbookLink: boolean;
    showPhotos: boolean;
    liveSharing: boolean;
  };
}

export const DRIVING_FLAGS: { key: string; label: string; emoji: string }[] = [
  { key: "curvy", label: "Svingete veier", emoji: "〰️" },
  { key: "views", label: "Fine utsikter", emoji: "🏔️" },
  { key: "photo", label: "Fotostopp", emoji: "📸" },
  { key: "tourist", label: "Nasjonale turistveier", emoji: "🇳🇴" },
  { key: "cruise", label: "Rolig cruise", emoji: "☕" },
  { key: "no-highway", label: "Unngå motorvei", emoji: "🛣️" },
  { key: "no-ferry", label: "Unngå ferger", emoji: "⛴️" },
  { key: "food", label: "Matpause underveis", emoji: "🍽️" },
  { key: "charging", label: "Ladestopp / drivstoff", emoji: "⛽" },
];

export const STOP_INTERESTS: { value: StopType; label: string; emoji: string }[] = [
  { value: "food", label: "Kafé / mat", emoji: "🍽️" },
  { value: "viewpoint", label: "Utsiktspunkt", emoji: "🏔️" },
  { value: "attraction", label: "Attraksjoner", emoji: "✨" },
  { value: "photo", label: "Fotostopp", emoji: "📸" },
  { value: "fuel", label: "Drivstoff / lading", emoji: "⛽" },
  { value: "lodging", label: "Overnatting", emoji: "🛏️" },
  { value: "experience", label: "Lokale opplevelser", emoji: "🎒" },
  { value: "detour", label: "Camping / bobilplass", emoji: "🚐" },
  { value: "rest", label: "MC / bil-stopp", emoji: "🏍️" },
];

const DEFAULTS: DriverPrefs = {
  displayName: "Sjåfør",
  units: "km",
  language: "nb",
  defaultVehicle: "motorcycle",
  defaultStyle: "curvy",
  drivingFlags: { curvy: true, views: true, photo: true, tourist: true, "no-highway": true, food: true },
  stopInterests: ["food", "viewpoint", "photo", "experience"],
  maxDrivingHours: 6,
  pauseEveryMin: 120,
  sharing: { defaultPrivate: true, allowRoadbookLink: true, showPhotos: true, liveSharing: false },
};

const KEY = "veiglede.profile.v1";
const listeners = new Set<() => void>();
let cache: DriverPrefs | null = null;

function load(): DriverPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot(): DriverPrefs {
  if (!cache) cache = load();
  return cache;
}
function getServerSnapshot(): DriverPrefs { return DEFAULTS; }

export function useDriverPrefs() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function updateDriverPrefs(patch: Partial<DriverPrefs>) {
  const next = { ...getSnapshot(), ...patch };
  cache = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function toggleDrivingFlag(key: string) {
  const cur = getSnapshot();
  updateDriverPrefs({ drivingFlags: { ...cur.drivingFlags, [key]: !cur.drivingFlags[key] } });
}

export function toggleStopInterest(t: StopType) {
  const cur = getSnapshot();
  const has = cur.stopInterests.includes(t);
  updateDriverPrefs({
    stopInterests: has ? cur.stopInterests.filter((x) => x !== t) : [...cur.stopInterests, t],
  });
}
