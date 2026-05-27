import { useSyncExternalStore } from "react";

export type StopType = "viewpoint" | "photo" | "food" | "lodging" | "fuel" | "attraction" | "rest" | "city";
export type VehicleType = "motorcycle" | "car" | "rv";
export type RouteStyle = "fastest" | "scenic" | "curvy" | "photo" | "tourist" | "cruise";

export interface Stop {
  id: string;
  dayId: string;
  name: string;
  type: StopType;
  notes?: string;
  estimatedTime?: string;
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
  region?: string;
  origin: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  vehicle: VehicleType;
  style: RouteStyle;
  distanceKm: number;
  drivingTime: string;        // e.g. "5t 30min"
  stopsCount: number;
  cover: CoverKey;
  aiSummary?: string;
  createdAt: number;
}

export type CoverKey = "fjord" | "mountain" | "coast" | "valley" | "lofoten" | "forest";

interface State { trips: Trip[]; days: TripDay[]; stops: Stop[] }

const KEY = "veiglede.v2";
function uid() { return Math.random().toString(36).slice(2, 10); }

function seed(): State {
  const trips: Trip[] = [
    { id: "t-hardanger", title: "Hardangervidda MC", subtitle: "Svingete fjellvei over vidda", region: "Vestlandet", origin: "Drammen", destination: "Hardangervidda", startDate: "2026-06-07", vehicle: "motorcycle", style: "curvy", distanceKm: 287, drivingTime: "5t 30min", stopsCount: 4, cover: "mountain", aiSummary: "Vi har valgt Rv7 over vidda for åpne svinger, høyfjellsutsikt og lite trafikk i juni. To pauser er lagt inn der landskapet endrer karakter.", createdAt: Date.now() - 86400000 * 2 },
    { id: "t-fjords", title: "Norwegian Fjords", subtitle: "Kystperler fra Bergen til Trondheim", region: "Vestlandet", origin: "Bergen", destination: "Trondheim", startDate: "2026-06-12", endDate: "2026-06-18", vehicle: "car", style: "scenic", distanceKm: 712, drivingTime: "13t 45min", stopsCount: 9, cover: "fjord", aiSummary: "Ruta følger Kystriksveien for maksimal fjordutsikt. Vi unngår E39-tunnelene der vi kan.", createdAt: Date.now() - 86400000 * 6 },
    { id: "t-lofoten", title: "Lofoten Photo Trip", subtitle: "Lys, fjell og fiskevær", region: "Nord-Norge", origin: "Svolvær", destination: "Å", startDate: "2026-07-20", endDate: "2026-07-24", vehicle: "car", style: "photo", distanceKm: 134, drivingTime: "3t 10min", stopsCount: 7, cover: "lofoten", aiSummary: "Korte etapper med lange opphold ved fotostopp. Tidsvindu satt etter midnattssolen.", createdAt: Date.now() - 86400000 * 9 },
    { id: "t-jotun", title: "Jotunheimen helg", subtitle: "Fjellpass og panoramavei", region: "Fjell-Norge", origin: "Oslo", destination: "Lom", startDate: "2026-08-14", endDate: "2026-08-16", vehicle: "motorcycle", style: "tourist", distanceKm: 412, drivingTime: "7t 20min", stopsCount: 6, cover: "valley", aiSummary: "Sognefjellet og Valdresflye gir to nasjonale turistveier i samme tur.", createdAt: Date.now() - 86400000 * 12 },
    { id: "t-numedal", title: "Numedal via Uvdal", subtitle: "Rolig dagstur i grønne daler", region: "Østlandet", origin: "Drammen", destination: "Geilo", startDate: "2026-05-30", vehicle: "car", style: "cruise", distanceKm: 198, drivingTime: "3t 45min", stopsCount: 3, cover: "valley", aiSummary: "Lav puls. Stavkirker, småbruk og en kaffepause ved Uvdal.", createdAt: Date.now() - 86400000 * 18 },
  ];

  const days: TripDay[] = [];
  const stops: Stop[] = [];

  // Hardangervidda — single day
  const d1 = { id: uid(), tripId: "t-hardanger", dayNumber: 1, title: "Drammen → Hardangervidda", date: "2026-06-07", summary: "Inn på Rv7, opp gjennom Numedal og videre over vidda." };
  days.push(d1);
  stops.push(
    { id: uid(), dayId: d1.id, name: "Kongsberg sentrum", type: "rest", estimatedTime: "09:15", location: "Kongsberg", notes: "Kaffe og strekk før Numedal.", order: 0 },
    { id: uid(), dayId: d1.id, name: "Uvdal stavkirke", type: "attraction", estimatedTime: "10:45", location: "Uvdal", notes: "Liten omvei verdt det. 15 min foto.", order: 1 },
    { id: uid(), dayId: d1.id, name: "Dyranut fjellstove", type: "food", estimatedTime: "13:00", location: "Hardangervidda", notes: "Lunsj med utsikt over vidda.", order: 2 },
    { id: uid(), dayId: d1.id, name: "Vøringsfossen platform", type: "viewpoint", estimatedTime: "15:30", location: "Eidfjord", notes: "Nye gangbroer over fossen.", order: 3 },
  );

  // Fjords — 3 days
  const f1 = { id: uid(), tripId: "t-fjords", dayNumber: 1, title: "Bergen → Flåm", date: "2026-06-12", summary: "Første smak av fjordene." };
  const f2 = { id: uid(), tripId: "t-fjords", dayNumber: 2, title: "Flåm → Geiranger", date: "2026-06-13", summary: "Trollstigen og 11 hårnålssvinger." };
  const f3 = { id: uid(), tripId: "t-fjords", dayNumber: 3, title: "Geiranger → Ålesund", date: "2026-06-14", summary: "Jugendbyen ved havet." };
  days.push(f1, f2, f3);
  stops.push(
    { id: uid(), dayId: f1.id, name: "Fisketorget Bergen", type: "food", estimatedTime: "08:30", location: "Bergen", order: 0 },
    { id: uid(), dayId: f1.id, name: "Stalheim utsikt", type: "viewpoint", estimatedTime: "12:00", location: "Stalheim", order: 1 },
    { id: uid(), dayId: f1.id, name: "Fretheim Hotel", type: "lodging", estimatedTime: "18:00", location: "Flåm", order: 2 },
    { id: uid(), dayId: f2.id, name: "Stegastein lookout", type: "viewpoint", estimatedTime: "09:30", location: "Aurland", order: 0 },
    { id: uid(), dayId: f2.id, name: "Trollstigen", type: "attraction", estimatedTime: "14:00", location: "Romsdalen", order: 1 },
    { id: uid(), dayId: f3.id, name: "Ørnesvingen", type: "viewpoint", estimatedTime: "10:00", location: "Geiranger", order: 0 },
  );

  // Lofoten — 2 days
  const l1 = { id: uid(), tripId: "t-lofoten", dayNumber: 1, title: "Svolvær → Reine", date: "2026-07-20", summary: "Klassiske fotostopp langs E10." };
  const l2 = { id: uid(), tripId: "t-lofoten", dayNumber: 2, title: "Reine → Å", date: "2026-07-21", summary: "Stranddag og fiskevær." };
  days.push(l1, l2);
  stops.push(
    { id: uid(), dayId: l1.id, name: "Henningsvær fotballbane", type: "photo", estimatedTime: "10:00", location: "Henningsvær", order: 0 },
    { id: uid(), dayId: l1.id, name: "Hamnøy bryggene", type: "photo", estimatedTime: "14:00", location: "Hamnøy", order: 1 },
    { id: uid(), dayId: l1.id, name: "Reine Rorbuer", type: "lodging", estimatedTime: "18:00", location: "Reine", order: 2 },
    { id: uid(), dayId: l2.id, name: "Kvalvika strand", type: "viewpoint", estimatedTime: "10:00", location: "Fredvang", order: 0 },
    { id: uid(), dayId: l2.id, name: "Å i Lofoten", type: "city", estimatedTime: "15:00", location: "Å", order: 1 },
  );

  // Jotun — 2 days
  const j1 = { id: uid(), tripId: "t-jotun", dayNumber: 1, title: "Oslo → Beitostølen", date: "2026-08-14" };
  const j2 = { id: uid(), tripId: "t-jotun", dayNumber: 2, title: "Beitostølen → Lom", date: "2026-08-15", summary: "Sognefjellet — Nord-Europas høyeste fjellovergang." };
  days.push(j1, j2);
  stops.push(
    { id: uid(), dayId: j1.id, name: "Valdresflye utsikt", type: "viewpoint", estimatedTime: "13:30", location: "Valdresflye", order: 0 },
    { id: uid(), dayId: j2.id, name: "Sognefjellshytta", type: "food", estimatedTime: "12:00", location: "Sognefjellet", order: 0 },
    { id: uid(), dayId: j2.id, name: "Lom stavkirke", type: "attraction", estimatedTime: "16:00", location: "Lom", order: 1 },
  );

  // Numedal — 1 day
  const n1 = { id: uid(), tripId: "t-numedal", dayNumber: 1, title: "Drammen → Geilo", date: "2026-05-30" };
  days.push(n1);
  stops.push(
    { id: uid(), dayId: n1.id, name: "Nore stavkirke", type: "attraction", estimatedTime: "10:30", location: "Nore", order: 0 },
    { id: uid(), dayId: n1.id, name: "Uvdal kafé", type: "food", estimatedTime: "12:30", location: "Uvdal", order: 1 },
    { id: uid(), dayId: n1.id, name: "Geilo sentrum", type: "city", estimatedTime: "15:00", location: "Geilo", order: 2 },
  );

  return { trips, days, stops };
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
  if (!initialized && typeof window !== "undefined") { state = load(); initialized = true; }
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
  createTrip(input: Omit<Trip, "id" | "createdAt" | "stopsCount"> & { stopsCount?: number }): Trip {
    ensureInit();
    const trip: Trip = { ...input, id: uid(), stopsCount: input.stopsCount ?? 0, createdAt: Date.now() };
    state = { ...state, trips: [trip, ...state.trips] };
    const day: TripDay = { id: uid(), tripId: trip.id, dayNumber: 1, title: `${trip.origin} → ${trip.destination}`, date: trip.startDate, summary: trip.aiSummary };
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
    const next = state.days.filter((d) => d.tripId === tripId).length + 1;
    const day: TripDay = { id: uid(), tripId, dayNumber: next, title: `Dag ${next}` };
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
    const stop: Stop = { id: uid(), dayId, name: input.name ?? "Nytt stopp", type: input.type ?? "attraction", notes: input.notes, estimatedTime: input.estimatedTime, location: input.location, order };
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
  { value: "viewpoint", label: "Utsikt", emoji: "🏔️" },
  { value: "photo", label: "Fotostopp", emoji: "📸" },
  { value: "food", label: "Mat", emoji: "🍽️" },
  { value: "lodging", label: "Overnatting", emoji: "🛏️" },
  { value: "fuel", label: "Drivstoff", emoji: "⛽" },
  { value: "attraction", label: "Attraksjon", emoji: "✨" },
  { value: "rest", label: "Pause", emoji: "☕" },
  { value: "city", label: "By", emoji: "🏘️" },
];
export function stopMeta(t: StopType) {
  return STOP_TYPES.find((s) => s.value === t) ?? STOP_TYPES[STOP_TYPES.length - 1];
}

export const VEHICLES: { value: VehicleType; label: string; emoji: string; sub: string }[] = [
  { value: "motorcycle", label: "Motorsykkel", emoji: "🏍️", sub: "Tur-MC · ADV · Sport · Vintage" },
  { value: "car", label: "Bil", emoji: "🚗", sub: "Sedan · Sportsbil · SUV · Veteran" },
  { value: "rv", label: "Bobil / Camper", emoji: "🚐", sub: "Lange etapper · plass for utstyr" },
];

export const ROUTE_STYLES: { value: RouteStyle; label: string; emoji: string; sub: string }[] = [
  { value: "fastest", label: "Raskeste vei", emoji: "⚡", sub: "Effektivt fra A til B" },
  { value: "scenic", label: "Fineste vei", emoji: "🏔️", sub: "Landskap og panoramautsikt" },
  { value: "curvy", label: "Svingete vei", emoji: "〰️", sub: "Kurver og ren kjøreglede" },
  { value: "photo", label: "Fototur", emoji: "📸", sub: "Stopp, se og avbild" },
  { value: "tourist", label: "Nasjonale turistveier", emoji: "🇳🇴", sub: "18 offisielle turistruter" },
  { value: "cruise", label: "Rolig cruise", emoji: "☕", sub: "Avslappet landevei" },
];
export function vehicleMeta(v: VehicleType) { return VEHICLES.find((x) => x.value === v) ?? VEHICLES[0]; }
export function styleMeta(s: RouteStyle) { return ROUTE_STYLES.find((x) => x.value === s) ?? ROUTE_STYLES[0]; }

export const COVERS: Record<CoverKey, string> = {
  fjord:    "from-[oklch(0.42_0.09_220)] via-[oklch(0.32_0.07_230)] to-[oklch(0.22_0.04_240)]",
  mountain: "from-[oklch(0.45_0.10_265)] via-[oklch(0.30_0.07_280)] to-[oklch(0.20_0.04_290)]",
  coast:    "from-[oklch(0.50_0.10_200)] via-[oklch(0.34_0.07_215)] to-[oklch(0.22_0.04_230)]",
  valley:   "from-[oklch(0.45_0.11_145)] via-[oklch(0.30_0.07_155)] to-[oklch(0.20_0.04_165)]",
  lofoten:  "from-[oklch(0.42_0.12_320)] via-[oklch(0.30_0.08_300)] to-[oklch(0.20_0.05_280)]",
  forest:   "from-[oklch(0.38_0.09_150)] via-[oklch(0.28_0.06_160)] to-[oklch(0.18_0.03_170)]",
};

export const FEATURED_ROUTES = [
  { id: "f1", title: "Atlanterhavsveien", region: "Møre og Romsdal", km: 8.3, style: "tourist" as RouteStyle, cover: "coast" as CoverKey, emoji: "🌊" },
  { id: "f2", title: "Trollstigen", region: "Romsdalen", km: 106, style: "curvy" as RouteStyle, cover: "mountain" as CoverKey, emoji: "🏔️" },
  { id: "f3", title: "Senja rundt", region: "Troms", km: 102, style: "scenic" as RouteStyle, cover: "lofoten" as CoverKey, emoji: "🌄" },
];
