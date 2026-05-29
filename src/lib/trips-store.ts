import { useSyncExternalStore } from "react";
import { lookupPlace, distanceToRoute } from "@/lib/geo";
import { computeTimeBreakdown } from "@/lib/trip-time";

export type StopType =
  | "viewpoint"
  | "photo"
  | "food"
  | "lodging"
  | "fuel"
  | "attraction"
  | "rest"
  | "city"
  | "experience"
  | "detour";

export type VehicleType = "motorcycle" | "car" | "rv";
export type RouteStyle = "fastest" | "scenic" | "curvy" | "photo" | "tourist" | "cruise";
export type EnergySource = "petrol" | "diesel" | "electric" | "hybrid";

export interface Stop {
  id: string;
  dayId: string;
  name: string;
  type: StopType;
  notes?: string;
  estimatedTime?: string;
  location?: string;
  order: number;
  // richer fields (all optional so legacy data stays valid)
  description?: string;
  reason?: string;
  durationMin?: number;
  /** Trip time v1: where the duration came from. Defaults to "default". */
  durationSource?: "default" | "user" | "ai" | "provider";
  /** Trip time v1: optional explicit override; otherwise inferred from type. */
  timeCategory?: "driving" | "pause" | "charging" | "meal" | "photo" | "ferry" | "overnight" | "other";
  distanceFromPrevKm?: number;
  photoOp?: boolean;
  promoted?: boolean;
  // Map foundation v1 — provider-agnostic geo + classification.
  // All optional so older cached trips keep working.
  lat?: number;
  lng?: number;
  title?: string;
  day?: number;
  isSuggestion?: boolean;
  isPartner?: boolean;
  isPhotoStop?: boolean;
  placement?: "along" | "detour" | "after" | "new-day" | "day";
  routeStatus?: "on-route" | "detour" | "suggestion";
  distanceFromRouteKm?: number;
  extraDistanceKm?: number;
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
  vehicleId?: string;
  vehicleName?: string;
  energy?: EnergySource;
  style: RouteStyle;
  distanceKm: number;
  drivingTime: string;
  stopsCount: number;
  cover: CoverKey;
  aiSummary?: string;
  createdAt: number;
  // Map foundation v1 — cached routing result so we don't re-bill ORS
  // every time the planner / roadbook mounts. All optional.
  originLoc?: { lat: number; lng: number };
  destinationLoc?: { lat: number; lng: number };
  routeGeometry?: { lat: number; lng: number }[];
  routeDistanceKm?: number;
  routeDurationMin?: number;
  routeProvider?: string;
  routeWaypointsHash?: string;
  // Routing v1.1 — honest source-of-truth fields from the routing provider.
  // Persisted so debug panels and the time budget can be transparent.
  routeProfile?: string;
  routeAvoidHighways?: boolean;
  routeAvoidFerries?: boolean;
  routeRawDistanceMeters?: number;
  routeRawDurationSeconds?: number;
  routeFerryDistanceKm?: number;
  routeFerryDurationMin?: number;
  routeFallbackEstimateMin?: number;
  // Map UX v1.1 — primary route is `routeGeometry`. Alternatives are reserved
  // for a future routing v2 where ORS / another provider returns multiple
  // options. Persisted so the planner can later let the user pick.
  routeAlternatives?: RouteAlternative[];
  // Trip time v1 — snapshot of the time breakdown computed at generation.
  // The UI recomputes live from current stops so it stays accurate when the
  // user edits — this snapshot is kept for debug / future analytics.
  timeBreakdown?: TripTimeBreakdownSnapshot;
}

export interface TripTimeBreakdownSnapshot {
  drivingMin: number;
  ferryMin?: number;
  plannedStopsMin: number;
  chargingMin?: number;
  mealMin?: number;
  photoStopMin?: number;
  restMin?: number;
  overnightMin?: number;
  totalActiveDayMin: number;
  totalTripMin: number;
  source: "ors" | "estimated" | "mixed";
  warnings?: string[];
}

export interface RouteAlternative {
  id: string;
  label: string;
  distanceKm: number;
  durationMin: number;
  geometry: { lat: number; lng: number }[];
  provider: string;
  summary?: string;
}

export type CoverKey = "fjord" | "mountain" | "coast" | "valley" | "lofoten" | "forest";

export interface SuggestedStop {
  id: string;
  name: string;
  type: StopType;
  location?: string;
  description: string;
  reason: string;
  durationMin?: number;
  photoOp?: boolean;
  promoted?: boolean;
  badge?: "partner" | "local" | "promoted";
  energy?: EnergySource; // for fuel/charging stops only
  lat?: number;
  lng?: number;
}

export interface SuggestedStopRouteMeta {
  distanceFromRouteKm: number;
  extraDistanceKm: number;
  detourMin: number;
  off: boolean;
}

export interface PartnerTip {
  id: string;
  name: string;
  category: string; // "Kafé", "Overnatting" etc
  emoji: string;
  location: string;
  blurb: string;
  badge: "partner" | "local" | "promoted";
  lat?: number;
  lng?: number;
}

export interface PhotoMemory {
  id: string;
  caption: string;
  location: string;
  emoji: string;
  stopId?: string;
}

interface State { trips: Trip[]; days: TripDay[]; stops: Stop[] }

const EMPTY_STATE: State = { trips: [], days: [], stops: [] };

const KEY = "veiglede.v4";
function uid() { return Math.random().toString(36).slice(2, 10); }

function seed(): State {
  const trips: Trip[] = [
    { id: "t-hardanger", title: "Hardangervidda MC", subtitle: "Svingete fjellvei over vidda", region: "Vestlandet", origin: "Drammen", destination: "Hardangervidda", startDate: "2026-06-07", vehicle: "motorcycle", style: "curvy", distanceKm: 287, drivingTime: "5t 30min", stopsCount: 4, cover: "mountain", aiSummary: "Vi har valgt Rv7 over vidda for åpne svinger, høyfjellsutsikt og lite trafikk i juni. To pauser er lagt inn der landskapet endrer karakter — og to fotostopp på partier med best lys ettermiddag.", createdAt: Date.now() - 86400000 * 2 },
    { id: "t-fjords", title: "Norwegian Fjords", subtitle: "Kystperler fra Bergen til Trondheim", region: "Vestlandet", origin: "Bergen", destination: "Trondheim", startDate: "2026-06-12", endDate: "2026-06-18", vehicle: "car", style: "scenic", distanceKm: 712, drivingTime: "13t 45min", stopsCount: 9, cover: "fjord", aiSummary: "Ruta følger Kystriksveien for maksimal fjordutsikt. Vi unngår E39-tunnelene der vi kan, og legger inn matpauser ved naturlige stopp.", createdAt: Date.now() - 86400000 * 6 },
    { id: "t-lofoten", title: "Lofoten Photo Trip", subtitle: "Lys, fjell og fiskevær", region: "Nord-Norge", origin: "Svolvær", destination: "Å", startDate: "2026-07-20", endDate: "2026-07-24", vehicle: "car", style: "photo", distanceKm: 134, drivingTime: "3t 10min", stopsCount: 7, cover: "lofoten", aiSummary: "Korte etapper med lange opphold ved fotostopp. Tidsvindu satt etter midnattssolen, og lokale tips lagt inn der det er verdt en omvei.", createdAt: Date.now() - 86400000 * 9 },
    { id: "t-jotun", title: "Jotunheimen helg", subtitle: "Fjellpass og panoramavei", region: "Fjell-Norge", origin: "Oslo", destination: "Lom", startDate: "2026-08-14", endDate: "2026-08-16", vehicle: "motorcycle", style: "tourist", distanceKm: 412, drivingTime: "7t 20min", stopsCount: 6, cover: "valley", aiSummary: "Sognefjellet og Valdresflye gir to nasjonale turistveier i samme tur, med jevne pauser og en god overnatting.", createdAt: Date.now() - 86400000 * 12 },
    { id: "t-numedal", title: "Numedal via Uvdal", subtitle: "Rolig dagstur i grønne daler", region: "Østlandet", origin: "Drammen", destination: "Geilo", startDate: "2026-05-30", vehicle: "car", style: "cruise", distanceKm: 198, drivingTime: "3t 45min", stopsCount: 3, cover: "valley", aiSummary: "Lav puls. Stavkirker, småbruk og en kaffepause ved Uvdal.", createdAt: Date.now() - 86400000 * 18 },
  ];

  const days: TripDay[] = [];
  const stops: Stop[] = [];

  const d1 = { id: uid(), tripId: "t-hardanger", dayNumber: 1, title: "Drammen → Hardangervidda", date: "2026-06-07", summary: "Inn på Rv7, opp gjennom Numedal og videre over vidda." };
  days.push(d1);
  stops.push(
    { id: uid(), dayId: d1.id, name: "Kongsberg sentrum", type: "rest", estimatedTime: "09:15", location: "Kongsberg", description: "Liten kaffepause før Numedal åpner seg.", reason: "Naturlig første pause etter ca 80 km motorvei.", durationMin: 20, distanceFromPrevKm: 84, notes: "Kaffe og strekk før Numedal.", order: 0 },
    { id: uid(), dayId: d1.id, name: "Uvdal stavkirke", type: "attraction", estimatedTime: "10:45", location: "Uvdal", description: "Stavkirke fra 1100-tallet, tre minutter fra Rv40.", reason: "Kort kulturstopp passer godt midtveis opp Numedal.", durationMin: 25, distanceFromPrevKm: 95, photoOp: true, order: 1 },
    { id: uid(), dayId: d1.id, name: "Dyranut fjellstove", type: "food", estimatedTime: "13:00", location: "Hardangervidda", description: "Klassisk fjellstove med varmrett og hjemmelagde kaker.", reason: "Eneste skikkelige matstopp før Eidfjord — lagt inn for å unngå sulten kjøring over vidda.", durationMin: 50, distanceFromPrevKm: 73, order: 2 },
    { id: uid(), dayId: d1.id, name: "Vøringsfossen platform", type: "viewpoint", estimatedTime: "15:30", location: "Eidfjord", description: "Nye gangbroer over Norges mest kjente foss.", reason: "Dramatisk avslutning på dagen — godt ettermiddagslys.", durationMin: 45, distanceFromPrevKm: 35, photoOp: true, order: 3 },
  );

  const f1 = { id: uid(), tripId: "t-fjords", dayNumber: 1, title: "Bergen → Flåm", date: "2026-06-12", summary: "Første smak av fjordene." };
  const f2 = { id: uid(), tripId: "t-fjords", dayNumber: 2, title: "Flåm → Geiranger", date: "2026-06-13", summary: "Trollstigen og 11 hårnålssvinger." };
  const f3 = { id: uid(), tripId: "t-fjords", dayNumber: 3, title: "Geiranger → Ålesund", date: "2026-06-14", summary: "Jugendbyen ved havet." };
  days.push(f1, f2, f3);
  stops.push(
    { id: uid(), dayId: f1.id, name: "Fisketorget Bergen", type: "food", estimatedTime: "08:30", location: "Bergen", description: "Frokost på torget før utfart.", reason: "God start på dagen — kort vei til E16.", durationMin: 40, order: 0 },
    { id: uid(), dayId: f1.id, name: "Stalheim utsikt", type: "viewpoint", estimatedTime: "12:00", location: "Stalheim", description: "Det berømte utsynet ned Nærøydalen.", reason: "Klassisk panorama — passer perfekt etter Vossevangen.", durationMin: 30, distanceFromPrevKm: 132, photoOp: true, order: 1 },
    { id: uid(), dayId: f1.id, name: "Fretheim Hotel", type: "lodging", estimatedTime: "18:00", location: "Flåm", description: "Historisk hotell ved Flåmsbana.", reason: "Naturlig overnatting før neste fjordetappe.", durationMin: 720, distanceFromPrevKm: 48, order: 2 },
    { id: uid(), dayId: f2.id, name: "Stegastein lookout", type: "viewpoint", estimatedTime: "09:30", location: "Aurland", description: "Utsiktsplattform 650 m over Aurlandsfjorden.", reason: "Beste utsikten på hele turen — uten omvei.", durationMin: 35, distanceFromPrevKm: 12, photoOp: true, order: 0 },
    { id: uid(), dayId: f2.id, name: "Trollstigen", type: "attraction", estimatedTime: "14:00", location: "Romsdalen", description: "11 hårnålssvinger opp fjellsida.", reason: "Hovedopplevelsen midt på dagen.", durationMin: 60, distanceFromPrevKm: 198, photoOp: true, order: 1 },
    { id: uid(), dayId: f3.id, name: "Ørnesvingen", type: "viewpoint", estimatedTime: "10:00", location: "Geiranger", description: "Utsikt over Geirangerfjorden fra svingen.", reason: "Siste fjordutsikt før vi går mot kysten.", durationMin: 25, photoOp: true, order: 0 },
  );

  const l1 = { id: uid(), tripId: "t-lofoten", dayNumber: 1, title: "Svolvær → Reine", date: "2026-07-20", summary: "Klassiske fotostopp langs E10." };
  const l2 = { id: uid(), tripId: "t-lofoten", dayNumber: 2, title: "Reine → Å", date: "2026-07-21", summary: "Stranddag og fiskevær." };
  days.push(l1, l2);
  stops.push(
    { id: uid(), dayId: l1.id, name: "Henningsvær fotballbane", type: "photo", estimatedTime: "10:00", location: "Henningsvær", description: "Ikonisk bane mellom skjær og hav.", reason: "Best morgenlys fra øst.", durationMin: 40, photoOp: true, order: 0 },
    { id: uid(), dayId: l1.id, name: "Hamnøy bryggene", type: "photo", estimatedTime: "14:00", location: "Hamnøy", description: "Røde rorbuer mot Festheltinden.", reason: "Det mest fotograferte motivet i Lofoten.", durationMin: 30, photoOp: true, order: 1 },
    { id: uid(), dayId: l1.id, name: "Reine Rorbuer", type: "lodging", estimatedTime: "18:00", location: "Reine", description: "Tradisjonelle rorbuer ved fjorden.", reason: "Sentralt for kveldslys og morgenfoto.", durationMin: 720, order: 2 },
    { id: uid(), dayId: l2.id, name: "Kvalvika strand", type: "viewpoint", estimatedTime: "10:00", location: "Fredvang", description: "Skjult strand med 45 min vandring.", reason: "Lett detour for en uforglemmelig opplevelse.", durationMin: 180, photoOp: true, order: 0 },
    { id: uid(), dayId: l2.id, name: "Å i Lofoten", type: "city", estimatedTime: "15:00", location: "Å", description: "Veiens ende — tørrfisk og fiskeværmuseum.", reason: "Symbolsk avslutning på reisen.", durationMin: 90, order: 1 },
  );

  const j1 = { id: uid(), tripId: "t-jotun", dayNumber: 1, title: "Oslo → Beitostølen", date: "2026-08-14" };
  const j2 = { id: uid(), tripId: "t-jotun", dayNumber: 2, title: "Beitostølen → Lom", date: "2026-08-15", summary: "Sognefjellet — Nord-Europas høyeste fjellovergang." };
  days.push(j1, j2);
  stops.push(
    { id: uid(), dayId: j1.id, name: "Valdresflye utsikt", type: "viewpoint", estimatedTime: "13:30", location: "Valdresflye", description: "Åpne høyfjellsvidder på 1389 moh.", reason: "Beste utsikten på dag 1.", durationMin: 25, photoOp: true, order: 0 },
    { id: uid(), dayId: j2.id, name: "Sognefjellshytta", type: "food", estimatedTime: "12:00", location: "Sognefjellet", description: "Tradisjonsrik fjellstove på toppen.", reason: "Naturlig lunsj midt i fjellovergangen.", durationMin: 50, order: 0 },
    { id: uid(), dayId: j2.id, name: "Lom stavkirke", type: "attraction", estimatedTime: "16:00", location: "Lom", description: "En av Norges største stavkirker.", reason: "Kulturstopp før kvelden.", durationMin: 40, photoOp: true, order: 1 },
  );

  const n1 = { id: uid(), tripId: "t-numedal", dayNumber: 1, title: "Drammen → Geilo", date: "2026-05-30" };
  days.push(n1);
  stops.push(
    { id: uid(), dayId: n1.id, name: "Nore stavkirke", type: "attraction", estimatedTime: "10:30", location: "Nore", description: "Stavkirke fra 1100-tallet.", reason: "Liten kulturstopp underveis.", durationMin: 25, order: 0 },
    { id: uid(), dayId: n1.id, name: "Uvdal kafé", type: "food", estimatedTime: "12:30", location: "Uvdal", description: "Hjemmebakst og lett lunsj.", reason: "Eneste matsted midtveis.", durationMin: 45, order: 1 },
    { id: uid(), dayId: n1.id, name: "Geilo sentrum", type: "city", estimatedTime: "15:00", location: "Geilo", description: "Fjellbygd og veis ende for denne turen.", reason: "Ankomst.", durationMin: 60, order: 2 },
  );

  return { trips, days, stops };
}

function load(): State {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw);
  } catch { return seed(); }
}

let state: State = EMPTY_STATE;
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
function getServerSnapshot(): State { return EMPTY_STATE; }

function refreshTripDerivedState(tripId: string) {
  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) return;
  const days = state.days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const dayIds = new Set(days.map((d) => d.id));
  const stops = state.stops.filter((s) => dayIds.has(s.dayId));
  const breakdown = computeTimeBreakdown(trip, days, stops);
  state = {
    ...state,
    trips: state.trips.map((t) => (
      t.id === tripId ? { ...t, stopsCount: stops.length, timeBreakdown: breakdown } : t
    )),
  };
}

function getTripIdForDay(dayId: string): string | null {
  return state.days.find((d) => d.id === dayId)?.tripId ?? null;
}

function suggestionLoc(sug: Pick<SuggestedStop, "location" | "name">) {
  return lookupPlace(sug.location ?? sug.name);
}

export function useTripsStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const tripsApi = {
  createTrip(input: Omit<Trip, "id" | "createdAt" | "stopsCount"> & { stopsCount?: number }): Trip {
    ensureInit();
    const trip: Trip = { ...input, id: uid(), stopsCount: input.stopsCount ?? 0, createdAt: Date.now() };

    // Trip-planner UX v2: ALWAYS create a single Day 1 (origin → destination)
    // as a route draft. The user decides whether to split into days, add
    // overnights or extend the trip — we never force a multi-day itinerary
    // or auto-place suggested stops into a Day 2 the user didn't ask for.
    const day1: TripDay = {
      id: uid(),
      tripId: trip.id,
      dayNumber: 1,
      title: `${trip.origin} → ${trip.destination}`,
      date: trip.startDate,
      summary: trip.aiSummary,
    };
    const newStops: Stop[] = [
      {
        id: uid(), dayId: day1.id, order: 0,
        name: `Avgang ${trip.origin}`, type: "rest", location: trip.origin,
        description: "Start på dagen — sjekk dekktrykk, fyll tanken.",
        reason: "Felles startpunkt for ruta.", durationMin: 15,
      },
      {
        id: uid(), dayId: day1.id, order: 1,
        name: `Ankomst ${trip.destination}`, type: "city", location: trip.destination,
        description: "Veis ende for denne etappen.",
        reason: "Ankomst.", durationMin: 0,
      },
    ];

    const finalTrip = { ...trip, stopsCount: newStops.length };
    state = {
      trips: [finalTrip, ...state.trips],
      days: [...state.days, day1],
      stops: [...state.stops, ...newStops],
    };
    persist();
    return finalTrip;
  },

  updateTrip(id: string, patch: Partial<Trip>) {
    ensureInit();
    state = { ...state, trips: state.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    refreshTripDerivedState(id);
    persist();
  },
  /** Read the current trip + days + stops snapshot for a trip id. */
  getTripBundle(id: string): { trip: Trip | null; days: TripDay[]; stops: Stop[] } {
    ensureInit();
    const trip = state.trips.find((t) => t.id === id) ?? null;
    const days = state.days.filter((d) => d.tripId === id);
    const dayIds = new Set(days.map((d) => d.id));
    const stops = state.stops.filter((s) => dayIds.has(s.dayId));
    return { trip, days, stops };
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
    const stop: Stop = {
      id: uid(),
      dayId,
      name: input.name ?? "Nytt stopp",
      type: input.type ?? "attraction",
      notes: input.notes,
      estimatedTime: input.estimatedTime,
      location: input.location,
      description: input.description,
      reason: input.reason,
      durationMin: input.durationMin,
      distanceFromPrevKm: input.distanceFromPrevKm,
      photoOp: input.photoOp,
      promoted: input.promoted,
      lat: input.lat,
      lng: input.lng,
      placement: input.placement,
      routeStatus: input.routeStatus,
      distanceFromRouteKm: input.distanceFromRouteKm,
      extraDistanceKm: input.extraDistanceKm,
      order,
    };
    state = { ...state, stops: [...state.stops, stop] };
    const tripId = getTripIdForDay(dayId);
    if (tripId) refreshTripDerivedState(tripId);
    persist();
    return stop;
  },
  updateStop(id: string, patch: Partial<Stop>) {
    ensureInit();
    const stop = state.stops.find((s) => s.id === id);
    state = { ...state, stops: state.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
    if (stop) {
      const tripId = getTripIdForDay(stop.dayId);
      if (tripId) refreshTripDerivedState(tripId);
    }
    persist();
  },
  deleteStop(id: string) {
    ensureInit();
    const stop = state.stops.find((s) => s.id === id);
    state = { ...state, stops: state.stops.filter((s) => s.id !== id) };
    if (stop) {
      const tripId = getTripIdForDay(stop.dayId);
      if (tripId) refreshTripDerivedState(tripId);
    }
    persist();
  },
  moveStop(id: string, direction: -1 | 1) {
    ensureInit();
    const stop = state.stops.find((s) => s.id === id);
    if (!stop) return;
    const siblings = state.stops.filter((s) => s.dayId === stop.dayId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx], b = siblings[swapIdx];
    state = {
      ...state,
      stops: state.stops.map((s) => {
        if (s.id === a.id) return { ...s, order: b.order };
        if (s.id === b.id) return { ...s, order: a.order };
        return s;
      }),
    };
    const tripId = getTripIdForDay(stop.dayId);
    if (tripId) refreshTripDerivedState(tripId);
    persist();
  },
  addSuggestion(tripId: string, sug: SuggestedStop): Stop | null {
    ensureInit();
    const tripDays = state.days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
    if (tripDays.length === 0) return null;
    // add to day with fewest stops
    const counts = tripDays.map((d) => state.stops.filter((s) => s.dayId === d.id).length);
    const targetDay = tripDays[counts.indexOf(Math.min(...counts))];
    return this.addStop(targetDay.id, {
      name: sug.name,
      type: sug.type,
      location: sug.location,
      description: sug.description,
      reason: sug.reason,
      durationMin: sug.durationMin,
      photoOp: sug.photoOp,
      promoted: sug.promoted,
    });
  },
  /**
   * Trip-planner UX v2 — add a suggestion with explicit placement chosen by
   * the user. "along" inserts before the arrival on the last day, "detour"
   * is the same but flagged as a detour. "after" appends a new day after
   * the current destination. "new-day" adds it as its own day. "day"
   * inserts at the bottom of a chosen day.
   */
  addSuggestionAt(
    tripId: string,
    sug: SuggestedStop,
    placement: "along" | "detour" | "after" | "new-day" | "day",
    targetDayId?: string,
    routeMeta?: SuggestedStopRouteMeta,
  ): Stop | null {
    ensureInit();
    const tripDays = state.days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
    if (tripDays.length === 0) return null;
    const loc = suggestionLoc(sug);
    const baseInput: Partial<Stop> = {
      name: sug.name,
      type: placement === "detour" ? "detour" : sug.type,
      location: sug.location,
      description: sug.description,
      reason: sug.reason,
      durationMin: sug.durationMin,
      photoOp: sug.photoOp,
      promoted: sug.promoted,
      lat: loc?.lat,
      lng: loc?.lng,
      placement,
      routeStatus: placement === "detour" ? "detour" : "on-route",
      isSuggestion: true,
      distanceFromRouteKm: routeMeta?.distanceFromRouteKm,
      extraDistanceKm: routeMeta?.extraDistanceKm,
    };
    if (placement === "along" || placement === "detour") {
      // insert before the arrival (last stop) of the last day
      const last = tripDays[tripDays.length - 1];
      const siblings = state.stops.filter((s) => s.dayId === last.id).sort((a, b) => a.order - b.order);
      const insertOrder = Math.max(0, siblings.length - 1);
      const stop = this.addStop(last.id, baseInput);
      // shift the arrival down
      state = {
        ...state,
        stops: state.stops.map((s) => {
          if (s.id === stop.id) return { ...s, order: insertOrder };
          if (s.dayId === last.id && s.id !== stop.id && s.order >= insertOrder) {
            return { ...s, order: s.order + 1 };
          }
          return s;
        }),
      };
      persist();
      return stop;
    }
    if (placement === "new-day" || placement === "after") {
      const newDay = this.addDay(tripId);
      this.updateDay(newDay.id, { title: sug.location ? `${sug.location}` : sug.name });
      return this.addStop(newDay.id, baseInput);
    }
    // placement === "day"
    const dayId = targetDayId ?? tripDays[tripDays.length - 1].id;
    return this.addStop(dayId, baseInput);
  },
  /**
   * Trip-planner UX v2 — split the current trip into N days by adding
   * empty days at the end. Existing day 1 keeps origin/destination stops.
   */
  splitIntoDays(tripId: string, count: number) {
    ensureInit();
    const current = state.days.filter((d) => d.tripId === tripId).length;
    for (let i = current; i < count; i++) this.addDay(tripId);
  },
  /**
   * Trip-planner UX v2 — add an overnight at the current destination
   * (or a specified location). Creates a lodging stop on the last day.
   */
  addOvernight(tripId: string, location?: string): Stop | null {
    ensureInit();
    const trip = state.trips.find((t) => t.id === tripId);
    if (!trip) return null;
    const tripDays = state.days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
    if (tripDays.length === 0) return null;
    const last = tripDays[tripDays.length - 1];
    const place = location ?? trip.destination;
    return this.addStop(last.id, {
      name: `Overnatting i ${place}`,
      type: "lodging",
      location: place,
      description: "Overnatting før neste etappe.",
      reason: "Naturlig stopp for natten.",
      durationMin: 720,
    });
  },
  /**
   * Trip-planner UX v2 — extend the trip with a new leg to the next
   * destination. Adds a new day with an arrival stop and updates the
   * trip's destination. Map geometry is NOT re-computed here; the planner
   * shows a hint that the route updates on next generation.
   */
  addDestination(tripId: string, place: string, loc?: { lat: number; lng: number }) {
    ensureInit();
    const trip = state.trips.find((t) => t.id === tripId);
    if (!trip) return null;
    const previousDestination = trip.destination;
    const newDay = this.addDay(tripId);
    this.updateDay(newDay.id, {
      title: `${previousDestination} → ${place}`,
      summary: `Ny etappe lagt til. Generer rute på nytt for å oppdatere kart og tider.`,
    });
    const stop = this.addStop(newDay.id, {
      name: `Ankomst ${place}`,
      type: "city",
      location: place,
      description: "Neste mål for turen.",
      reason: "Lagt til som ny destinasjon.",
      durationMin: 0,
    });
    this.updateTrip(tripId, { destination: place, destinationLoc: loc ?? trip.destinationLoc });
    return stop;
  },

};

function shiftDate(start: string | undefined, days: number): string | undefined {
  if (!start) return undefined;
  const d = new Date(start);
  if (isNaN(d.getTime())) return start;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatPause(min: number): string {
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return h === 1 ? "hver time" : h === 2 ? "annenhver time" : `hver ${h}. time`;
  }
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `hver ${h}t ${m}min`;
  }
  return `hvert ${min}. minutt`;
}

interface SuggestedSeed {
  name: string;
  type: StopType;
  location?: string;
  time?: string;
  notes?: string;
  description?: string;
  reason?: string;
  durationMin?: number;
  distanceFromPrevKm?: number;
  photoOp?: boolean;
}

function suggestStops(trip: Trip): SuggestedSeed[] {
  const base: SuggestedSeed[] = [
    { name: `Avgang ${trip.origin}`, type: "rest", location: trip.origin, time: "08:30", description: "Sjekk dekktrykk, fyll tanken, klar for tur.", reason: "Felles start gjør resten av dagen lettere å planlegge.", durationMin: 15 },
  ];
  switch (trip.style) {
    case "scenic":
      base.push(
        { name: "Panoramautsikt", type: "viewpoint", time: "10:30", description: "Åpent utsyn over landskapet.", reason: "Lagt inn der ruten har sitt første store panorama.", durationMin: 25, distanceFromPrevKm: 75, photoOp: true },
        { name: "Lokal kafé", type: "food", time: "12:30", description: "Hjemmebakst og enkel lunsj.", reason: "Naturlig matpause halvveis.", durationMin: 45, distanceFromPrevKm: 60 },
        { name: "Fjordutsikt", type: "viewpoint", time: "15:00", description: "Klassisk fjordmotiv fra veien.", reason: "Ettermiddagslys gir best foto her.", durationMin: 20, distanceFromPrevKm: 80, photoOp: true },
      );
      break;
    case "curvy":
      base.push(
        { name: "Hårnålspass", type: "viewpoint", time: "10:30", description: "Tekniske svinger med rolig trafikk.", reason: "Valgt for kjøreglede — start når veien er tørr.", durationMin: 20, distanceFromPrevKm: 70, photoOp: true },
        { name: "Drivstoff", type: "fuel", time: "12:00", description: "Siste bensinstasjon før fjellet.", reason: "Lagt inn for å unngå tom tank i fjellet.", durationMin: 10, distanceFromPrevKm: 55 },
        { name: "Fjellovergang", type: "viewpoint", time: "14:00", description: "Høyt fjellpass med vidt utsyn.", reason: "Hovedopplevelsen på en svingete tur.", durationMin: 30, distanceFromPrevKm: 65, photoOp: true },
      );
      break;
    case "photo":
      base.push(
        { name: "Morgenlys fotostopp", type: "photo", time: "09:30", description: "Lavt sidelys på fjellsiden.", reason: "Best lys 30 min etter soloppgang.", durationMin: 30, distanceFromPrevKm: 40, photoOp: true },
        { name: "Ikonisk landskap", type: "photo", time: "11:30", description: "Klassisk motiv mange tar.", reason: "Veivalget her er bedre enn alternativene.", durationMin: 40, distanceFromPrevKm: 60, photoOp: true, notes: "Husk stativ for HDR." },
        { name: "Lunch med utsikt", type: "food", time: "13:30", description: "Enkel mat, vid utsikt.", reason: "Pause før ettermiddagslyset.", durationMin: 45, distanceFromPrevKm: 50 },
        { name: "Gylden time", type: "photo", time: "18:00", description: "Beste lyset på dagen.", reason: "Plassert der ruten peker mot vest.", durationMin: 40, distanceFromPrevKm: 70, photoOp: true },
      );
      break;
    case "tourist":
      base.push(
        { name: "Nasjonal turistvei", type: "attraction", time: "11:00", description: "Offisiell rasteplass med arkitektur.", reason: "Lagt inn fordi ruten krysser en turistvei.", durationMin: 30, distanceFromPrevKm: 80 },
        { name: "Lokal severdighet", type: "attraction", time: "13:30", description: "Stavkirke eller museum nær veien.", reason: "Kort omvei — passer godt etter lunsj.", durationMin: 35, distanceFromPrevKm: 55, photoOp: true },
        { name: "Utkikkspunkt", type: "viewpoint", time: "15:30", description: "Klassisk utsiktspunkt.", reason: "Avslutter dagen med god utsikt.", durationMin: 25, distanceFromPrevKm: 70, photoOp: true },
      );
      break;
    case "cruise":
      base.push(
        { name: "Rolig kaffepause", type: "rest", time: "10:30", description: "Liten kafé ved veien.", reason: "Lav puls — første pause kommer tidlig.", durationMin: 25, distanceFromPrevKm: 60 },
        { name: "Lunsj på bryggekanten", type: "food", time: "13:00", description: "Lett lunsj nær vannet.", reason: "Naturlig matpause uten stress.", durationMin: 60, distanceFromPrevKm: 70 },
      );
      break;
    case "fastest":
      base.push(
        { name: "Drivstoff", type: "fuel", time: "10:30", description: "Rask stopp ved E-vei.", reason: "Optimalisert for tid — tank og strekk.", durationMin: 10, distanceFromPrevKm: 120 },
        { name: "Rask matpause", type: "food", time: "13:00", description: "Take-away eller veikro.", reason: "Holder farten oppe.", durationMin: 25, distanceFromPrevKm: 130 },
      );
      break;
  }
  if (trip.distanceKm > 300) {
    base.push({ name: "Overnatting", type: "lodging", time: "19:00", description: "Anbefalt stoppested for natten.", reason: "Turen er for lang for én dag — naturlig deling her.", durationMin: 720 });
  }
  base.push({ name: `Ankomst ${trip.destination}`, type: "city", location: trip.destination, time: "17:30", description: "Veis ende.", reason: "Ankomst." });
  return base;
}

// ----- Suggestions along the route (NOT yet added) -----

const ALONG_THE_ROUTE: SuggestedStop[] = [
  { id: "sr1", name: "Fjellkafé Bjorli", type: "food", location: "Bjorli", description: "Vedfyrt kafé med utsikt mot Romsdalen.", reason: "Ligger 5 min fra hovedruta — populært stopp.", durationMin: 35, badge: "local" },
  { id: "sr2", name: "Trollveggen utsikt", type: "viewpoint", location: "Romsdalen", description: "Europas høyeste loddrette fjellvegg.", reason: "Like ved veien — ingen ekstra kjøretid.", durationMin: 20, photoOp: true, badge: "local" },
  { id: "sr3", name: "Geitost-bakeriet", type: "experience", location: "Undredal", description: "Smaksprøver av brunost rett fra produsenten.", reason: "Lite, lokalt og passer en kort pause.", durationMin: 30, badge: "partner", promoted: true },
  { id: "sr4", name: "Aurland charging hub", type: "fuel", location: "Aurland", description: "8x 150 kW ladere med utsikt.", reason: "Eneste hurtiglader i området.", durationMin: 25, badge: "partner", promoted: true, energy: "electric" },
  { id: "sr5", name: "Stranddetour Ersfjord", type: "detour", location: "Senja", description: "20 km detour til hvit sandstrand.", reason: "Anbefales hvis du har en time ekstra.", durationMin: 60, photoOp: true, badge: "local" },
  { id: "sr6", name: "Cabin Lodge Vågåmo", type: "lodging", location: "Vågåmo", description: "Tømmerhytter ved elva, frokost inkludert.", reason: "Godt overnattingsalternativ midtveis.", durationMin: 720, badge: "partner", promoted: true },
  { id: "sr7", name: "Fjellguide-tur", type: "experience", location: "Lofoten", description: "2t guidet tur til lokal topp.", reason: "Perfekt for de som vil ut av bilen.", durationMin: 120, badge: "local" },
  { id: "sr8", name: "Solnedgang Stadlandet", type: "photo", location: "Stadlandet", description: "Vestligste punkt — åpent hav.", reason: "Lagt inn fordi ruten passerer på rett tid for solnedgang.", durationMin: 40, photoOp: true, badge: "local" },
  { id: "sr9", name: "MC-svingene over Gaularfjellet", type: "viewpoint", location: "Gaularfjellet", description: "Tette hårnålssvinger med rolig sommertrafikk.", reason: "Klassiker for tur-MC — passer svingete kjørestil.", durationMin: 30, photoOp: true, badge: "local" },
  { id: "sr10", name: "Bobilparkering Geirangerfjord", type: "detour", location: "Geiranger", description: "Stor plass med tømming, strøm og fjordutsikt.", reason: "Sjekket høyde og lengde — passer bobil/camper.", durationMin: 720, badge: "local" },
  { id: "sr11", name: "Camping Jostedal", type: "lodging", location: "Jostedalen", description: "Familievennlig camping ved breen, hytter og teltplass.", reason: "Naturlig overnatting for rolig cruise med bobil eller bil.", durationMin: 720, badge: "partner", promoted: true },
  { id: "sr12", name: "Bryggekafé Balestrand", type: "food", location: "Balestrand", description: "Lett lunsj på brygga med Sognefjorden utenfor.", reason: "Mat-pause med utsikt — perfekt for en scenic biltur.", durationMin: 50, badge: "local" },
  { id: "sr13", name: "Museum Norsk Vegmuseum", type: "attraction", location: "Lillehammer", description: "Norges veihistorie, gratis inngang.", reason: "Hyggelig kulturstopp under en rolig biltur.", durationMin: 60, badge: "local" },
  { id: "sr14", name: "Pause Hjerkinn", type: "rest", location: "Dovrefjell", description: "Rasteplass med benker, do og turstier.", reason: "God plass for å strekke beina ca. midtveis.", durationMin: 20, badge: "local" },
  { id: "sr15", name: "Circle K Lom", type: "fuel", location: "Lom", description: "Døgnåpen bensinstasjon før Sognefjellet.", reason: "Siste fyllestasjon før fjellovergangen.", durationMin: 10, badge: "local", energy: "petrol" },
  { id: "sr16", name: "Recharge Dombås", type: "fuel", location: "Dombås", description: "12x 300 kW lynladere med kafé.", reason: "Beste ladepunkt før Dovrefjell.", durationMin: 30, badge: "partner", promoted: true, energy: "electric" },
];

export function getRouteSuggestions(trip: Trip, stopInterests?: StopType[]): SuggestedStop[] {
  const pool = [...ALONG_THE_ROUTE];
  const interests = new Set(stopInterests ?? []);
  const energy = trip.energy;
  const score = (s: SuggestedStop) => {
    let n = 0;
    // style weights
    if (trip.style === "photo" && s.photoOp) n += 3;
    if (trip.style === "scenic" && (s.type === "viewpoint" || s.type === "detour" || s.type === "food")) n += 2;
    if (trip.style === "cruise" && (s.type === "food" || s.type === "experience" || s.type === "rest" || s.type === "lodging")) n += 2;
    if (trip.style === "tourist" && (s.type === "attraction" || s.type === "experience")) n += 2;
    if (trip.style === "curvy" && (s.type === "viewpoint" || s.photoOp)) n += 2;
    // vehicle weights
    if (trip.vehicle === "motorcycle" && (s.type === "viewpoint" || s.photoOp || s.type === "rest")) n += 2;
    if (trip.vehicle === "motorcycle" && s.type === "lodging") n -= 1;
    if (trip.vehicle === "car" && (s.type === "food" || s.type === "attraction")) n += 1;
    if (trip.vehicle === "rv" && (s.type === "lodging" || s.type === "detour" || s.type === "rest")) n += 3;
    if (trip.vehicle === "rv" && s.type === "fuel") n += 1;
    // energy: filter fuel/charging to vehicle's energy type
    if (s.type === "fuel" && s.energy && energy) {
      if (s.energy === energy) n += 3;
      else if (s.energy === "electric" && energy === "hybrid") n += 1;
      else if (s.energy === "petrol" && energy === "hybrid") n += 1;
      else n -= 5; // hide a charging hub from a petrol car etc.
    }
    // driver interests (highest weight)
    if (interests.has(s.type)) n += 4;
    if (interests.has("photo") && s.photoOp) n += 2;
    return n + Math.random() * 0.5;
  };
  const scored = pool.sort((a, b) => score(b) - score(a));

  // Filter to suggestions geographically inside the route's bounding box
  // (with ~50km buffer) and sort by distance from the actual route line.
  const geom = trip.routeGeometry && trip.routeGeometry.length > 0 ? trip.routeGeometry : null;
  if (!geom) return scored.slice(0, 5);

  const BUFFER = 0.5;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of geom) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  minLng -= BUFFER; maxLng += BUFFER; minLat -= BUFFER; maxLat += BUFFER;

  const withLoc = scored
    .map((s) => ({ s, loc: lookupPlace(s.location ?? s.name) }))
    .filter(({ loc }) => !!loc && loc.lng >= minLng && loc.lng <= maxLng && loc.lat >= minLat && loc.lat <= maxLat)
    .map(({ s, loc }) => ({ s, d: distanceToRoute(loc!, geom) }))
    .sort((a, b) => a.d - b.d)
    .map(({ s }) => s);

  return withLoc.slice(0, 5);
}

// ----- Partner / local tips -----

const PARTNER_TIPS: PartnerTip[] = [
  { id: "p1", name: "Hardanger Bakery", category: "Bakeri", emoji: "🥐", location: "Eidfjord", blurb: "Surdeigsbrød og kanelsnurrer rett fra ovnen.", badge: "partner" },
  { id: "p2", name: "Fjordview Cabins", category: "Overnatting", emoji: "🛖", location: "Aurland", blurb: "Små hytter med utsikt, 10% for Veiglede-brukere.", badge: "promoted" },
  { id: "p3", name: "Trollstigen Café", category: "Kafé", emoji: "☕", location: "Romsdalen", blurb: "Anbefalt av lokale MC-klubber.", badge: "local" },
  { id: "p4", name: "Lofoten Fish & Co", category: "Restaurant", emoji: "🐟", location: "Reine", blurb: "Fersk fisk, åpent til 22:00 hele sommeren.", badge: "local" },
  { id: "p5", name: "Mountain Charge", category: "Lading", emoji: "🔌", location: "Geilo", blurb: "Hurtiglader med varmestue og kaffeautomat.", badge: "partner" },
  { id: "p6", name: "Numedal Local Museum", category: "Museum", emoji: "🏛️", location: "Uvdal", blurb: "Lite museum med inngangsbillett 80 kr.", badge: "local" },
];

export function getPartnerTips(trip: Trip): PartnerTip[] {
  // mix 3 — bias scenic/tourist to museum/cafe; photo to scenic spots
  const pool = [...PARTNER_TIPS].sort(() => Math.random() - 0.5);
  return pool.slice(0, 3 + (trip.distanceKm > 400 ? 1 : 0));
}

// ----- Photo memories (placeholder concept) -----

export function getPhotoMemories(trip: Trip, tripStops: Stop[]): PhotoMemory[] {
  const photoStops = tripStops.filter((s) => s.type === "photo" || s.type === "viewpoint" || s.photoOp);
  const palette = ["📷", "🌅", "🏔️", "🌊", "🌄", "🌌"];
  return photoStops.slice(0, 6).map((s, i) => ({
    id: `pm-${s.id}`,
    caption: s.name,
    location: s.location ?? trip.region ?? "",
    emoji: palette[i % palette.length],
    stopId: s.id,
  }));
}

// ----- AI summary builder -----

export interface AiPrefsInput {
  drivingFlags?: Record<string, boolean>;
  stopInterests?: StopType[];
  maxDrivingHours?: number;
  pauseEveryMin?: number;
}

export function buildAiSummary(input: {
  origin: string; destination: string; vehicle: VehicleType; style: RouteStyle;
  energy?: EnergySource; vehicleName?: string;
  userPrompt?: string; prefs?: AiPrefsInput;
}): string {
  const v = vehicleMeta(input.vehicle);
  const s = styleMeta(input.style);
  const parts: string[] = [];
  const vehicleLabel = input.vehicleName ?? v.label.toLowerCase();
  parts.push(`Ruten fra ${input.origin} til ${input.destination} er bygget for ${vehicleLabel} med ${s.label.toLowerCase()}.`);
  switch (input.style) {
    case "curvy":
      parts.push("Vi prioriterer svingete strekninger og unngår motorvei der det er praktisk.");
      break;
    case "scenic":
      parts.push("Vi prioriterer veier med åpne fjord- og fjellutsikter, og legger inn utsiktspunkter underveis.");
      break;
    case "photo":
      parts.push("Fotostopp er plassert der lyset er best og hvor landskapet endrer karakter.");
      break;
    case "tourist":
      parts.push("Ruten krysser nasjonale turistveier der det gir mening, med rasteplasser og lokal arkitektur.");
      break;
    case "cruise":
      parts.push("Tempoet er rolig — pauser legges naturlig inn, og dagene deles opp så du aldri føler at du må skynde deg.");
      break;
    case "fastest":
      parts.push("Vi har valgt mest effektive vei og kun lagt inn nødvendige pauser.");
      break;
  }
  if (input.vehicle === "motorcycle") {
    parts.push("På MC vekter vi kjøreglede — pausene er korte og lagt der det er trygt å stige av sykkelen.");
  } else if (input.vehicle === "rv") {
    parts.push("For bobil holder vi etappene rolige og prioriterer stopp med plass, høyde og overnatting/camping.");
  } else if (input.vehicle === "car") {
    parts.push("På bil bygger vi inn behagelige matpauser og attraksjoner langs ruta — uten å miste rytmen.");
  }
  if (input.energy === "electric") {
    parts.push("Siden bilen er elektrisk, planlegger vi ladestopp ved hurtigladere — ikke bensinstasjoner.");
  } else if (input.energy === "hybrid") {
    parts.push("Som hybrid kan du både lade og tanke — vi tar med begge typer stopp.");
  } else if (input.energy === "diesel") {
    parts.push("Diesel er rikelig på ruta, så vi prioriterer komfort og pauser fremfor å jakte stasjoner.");
  } else if (input.energy === "petrol") {
    parts.push("Vi unngår elektriske ladestopp og holder oss til bensinstasjoner langs ruta.");
  }

  const p = input.prefs;
  if (p) {
    const flags = p.drivingFlags ?? {};
    const wants: string[] = [];
    if (flags["views"]) wants.push("fine utsikter");
    if (flags["photo"] || p.stopInterests?.includes("photo")) wants.push("fotostopp");
    if (flags["tourist"]) wants.push("nasjonale turistveier");
    if (flags["food"] || p.stopInterests?.includes("food")) wants.push("matpauser");
    if (flags["charging"] || p.stopInterests?.includes("fuel")) wants.push("drivstoff/lading");
    if (p.stopInterests?.includes("lodging")) wants.push("overnattingsforslag");
    if (p.stopInterests?.includes("detour")) wants.push("camping- og bobilstopp");
    if (p.stopInterests?.includes("attraction")) wants.push("attraksjoner");
    if (wants.length) parts.push(`Profilen din vektlegger ${wants.join(", ")} — det er bakt inn i forslagene.`);

    const avoid: string[] = [];
    if (flags["no-highway"]) avoid.push("motorvei");
    if (flags["no-ferry"]) avoid.push("ferger");
    if (avoid.length) parts.push(`Vi unngår ${avoid.join(" og ")} der ruta tillater det, selv om det betyr noen ekstra kilometer.`);

    if (p.maxDrivingHours && p.pauseEveryMin) {
      parts.push(`Dagsetapper holdes innenfor ca ${p.maxDrivingHours} timer kjøring, med pause omtrent ${formatPause(p.pauseEveryMin)}.`);
    } else if (p.maxDrivingHours) {
      parts.push(`Dagsetapper holdes innenfor ca ${p.maxDrivingHours} timer kjøring.`);
    }
  }

  parts.push("Lokale tips og partnerstopp dukker bare opp når de faktisk passer ruten.");
  if (input.userPrompt) parts.push(`Ekstra hensyn: «${input.userPrompt}».`);
  return parts.join(" ");
}

export const STOP_TYPES: { value: StopType; label: string; emoji: string }[] = [
  { value: "viewpoint", label: "Utsikt", emoji: "🏔️" },
  { value: "photo", label: "Fotostopp", emoji: "📸" },
  { value: "food", label: "Mat", emoji: "🍽️" },
  { value: "lodging", label: "Overnatting", emoji: "🛏️" },
  { value: "fuel", label: "Drivstoff", emoji: "⛽" },
  { value: "attraction", label: "Attraksjon", emoji: "✨" },
  { value: "rest", label: "Pause", emoji: "☕" },
  { value: "city", label: "By", emoji: "🏘️" },
  { value: "experience", label: "Opplevelse", emoji: "🎒" },
  { value: "detour", label: "Detour", emoji: "↪️" },
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
