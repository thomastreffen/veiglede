import { useSyncExternalStore } from "react";

export type StopType = "city" | "attraction" | "lodging" | "food" | "viewpoint" | "fuel" | "other";

export interface Stop {
  id: string;
  dayId: string;
  name: string;
  type: StopType;
  notes?: string;
  estimatedTime?: string; // e.g. "1h 30m" or "09:30"
  location?: string;
  order: number;
}

export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  title: string;
  date?: string;
  summary?: string;
}

export interface Trip {
  id: string;
  title: string;
  subtitle?: string;
  origin: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  cover: string; // gradient key
  createdAt: number;
}

interface State {
  trips: Trip[];
  days: TripDay[];
  stops: Stop[];
}

const KEY = "roadbook.v1";

function uid() { return Math.random().toString(36).slice(2, 10); }

function seed(): State {
  const t1: Trip = { id: uid(), title: "Norwegian Fjords", subtitle: "Slow coastal drive through western Norway", origin: "Bergen", destination: "Trondheim", startDate: "2026-06-12", endDate: "2026-06-18", cover: "fjord", createdAt: Date.now() - 86400000 * 3 };
  const t2: Trip = { id: uid(), title: "Tuscan Backroads", subtitle: "Vineyards, hilltop towns and long lunches", origin: "Florence", destination: "Siena", startDate: "2026-09-04", endDate: "2026-09-09", cover: "tuscan", createdAt: Date.now() - 86400000 };
  const days: TripDay[] = [];
  const stops: Stop[] = [];
  const d1 = { id: uid(), tripId: t1.id, dayNumber: 1, title: "Bergen → Flåm", date: "2026-06-12", summary: "Coast, tunnels, first taste of the fjords." };
  const d2 = { id: uid(), tripId: t1.id, dayNumber: 2, title: "Flåm → Geiranger", date: "2026-06-13", summary: "Mountain passes and waterfalls." };
  const d3 = { id: uid(), tripId: t1.id, dayNumber: 3, title: "Geiranger → Ålesund", date: "2026-06-14", summary: "Art nouveau coastal town." };
  days.push(d1, d2, d3);
  stops.push(
    { id: uid(), dayId: d1.id, name: "Bergen Fish Market", type: "food", notes: "Early breakfast before the drive.", estimatedTime: "08:30", location: "Bergen", order: 0 },
    { id: uid(), dayId: d1.id, name: "Stalheim Viewpoint", type: "viewpoint", notes: "Stop for photos of the Nærøy valley.", estimatedTime: "12:00", location: "Stalheim", order: 1 },
    { id: uid(), dayId: d1.id, name: "Fretheim Hotel", type: "lodging", notes: "Historic hotel by the fjord.", estimatedTime: "18:00", location: "Flåm", order: 2 },
    { id: uid(), dayId: d2.id, name: "Stegastein Lookout", type: "viewpoint", estimatedTime: "09:15", location: "Aurland", order: 0 },
    { id: uid(), dayId: d2.id, name: "Trollstigen Pass", type: "attraction", notes: "Eleven hairpin bends.", estimatedTime: "14:00", location: "Romsdalen", order: 1 },
    { id: uid(), dayId: d3.id, name: "Eagle Road", type: "viewpoint", estimatedTime: "10:00", location: "Geiranger", order: 0 },
  );
  const d4 = { id: uid(), tripId: t2.id, dayNumber: 1, title: "Florence → Greve in Chianti", date: "2026-09-04", summary: "First vineyard stop." };
  days.push(d4);
  stops.push(
    { id: uid(), dayId: d4.id, name: "Piazzale Michelangelo", type: "viewpoint", estimatedTime: "08:00", location: "Florence", order: 0 },
    { id: uid(), dayId: d4.id, name: "Antica Macelleria Falorni", type: "food", notes: "Lunch and local cheeses.", estimatedTime: "13:00", location: "Greve", order: 1 },
  );
  return { trips: [t1, t2], days, stops };
}

function load(): State {
  if (typeof window === "undefined") return { trips: [], days: [], stops: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw);
  } catch { return seed(); }
}

let state: State = { trips: [], days: [], stops: [] };
let initialized = false;
const listeners = new Set<() => void>();

function ensureInit() {
  if (!initialized && typeof window !== "undefined") {
    state = load();
    initialized = true;
  }
}

function persist() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { ensureInit(); return state; }
function getServerSnapshot(): State { return { trips: [], days: [], stops: [] }; }

export function useTripsStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const tripsApi = {
  createTrip(input: Omit<Trip, "id" | "createdAt" | "cover"> & { cover?: string }): Trip {
    ensureInit();
    const trip: Trip = { ...input, id: uid(), createdAt: Date.now(), cover: input.cover ?? "sand" };
    state = { ...state, trips: [trip, ...state.trips] };
    // auto-create first day
    const day: TripDay = { id: uid(), tripId: trip.id, dayNumber: 1, title: `${trip.origin} → ?`, date: trip.startDate };
    state = { ...state, days: [...state.days, day] };
    persist();
    return trip;
  },
  deleteTrip(id: string) {
    ensureInit();
    const dayIds = state.days.filter((d) => d.tripId === id).map((d) => d.id);
    state = {
      trips: state.trips.filter((t) => t.id !== id),
      days: state.days.filter((d) => d.tripId !== id),
      stops: state.stops.filter((s) => !dayIds.includes(s.dayId)),
    };
    persist();
  },
  addDay(tripId: string) {
    ensureInit();
    const existing = state.days.filter((d) => d.tripId === tripId);
    const next = existing.length + 1;
    const day: TripDay = { id: uid(), tripId, dayNumber: next, title: `Day ${next}` };
    state = { ...state, days: [...state.days, day] };
    persist();
    return day;
  },
  updateDay(id: string, patch: Partial<TripDay>) {
    ensureInit();
    state = { ...state, days: state.days.map((d) => (d.id === id ? { ...d, ...patch } : d)) };
    persist();
  },
  deleteDay(id: string) {
    ensureInit();
    state = { ...state, days: state.days.filter((d) => d.id !== id), stops: state.stops.filter((s) => s.dayId !== id) };
    persist();
  },
  addStop(dayId: string, input: Partial<Stop> = {}): Stop {
    ensureInit();
    const order = state.stops.filter((s) => s.dayId === dayId).length;
    const stop: Stop = { id: uid(), dayId, name: input.name ?? "New stop", type: input.type ?? "attraction", notes: input.notes, estimatedTime: input.estimatedTime, location: input.location, order };
    state = { ...state, stops: [...state.stops, stop] };
    persist();
    return stop;
  },
  updateStop(id: string, patch: Partial<Stop>) {
    ensureInit();
    state = { ...state, stops: state.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
    persist();
  },
  deleteStop(id: string) {
    ensureInit();
    state = { ...state, stops: state.stops.filter((s) => s.id !== id) };
    persist();
  },
};

export const STOP_TYPES: { value: StopType; label: string; emoji: string }[] = [
  { value: "city", label: "City", emoji: "◉" },
  { value: "attraction", label: "Attraction", emoji: "✦" },
  { value: "lodging", label: "Lodging", emoji: "⌂" },
  { value: "food", label: "Food", emoji: "❋" },
  { value: "viewpoint", label: "Viewpoint", emoji: "△" },
  { value: "fuel", label: "Fuel", emoji: "⛽" },
  { value: "other", label: "Other", emoji: "•" },
];

export function stopMeta(t: StopType) {
  return STOP_TYPES.find((s) => s.value === t) ?? STOP_TYPES[STOP_TYPES.length - 1];
}
