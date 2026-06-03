// Trip time breakdown v1.
//
// Pure helpers — no React, no IO — so they can be called from generation,
// planner, roadbook and debug panels without coupling to the wizard.
//
// Driving time prefers ORS (`trip.routeDurationMin`) when available, then
// falls back to an estimate from `trip.distanceKm` so the breakdown always
// returns numbers (never undefined for the headline values).

import type { Trip, TripDay, Stop, StopType } from "@/lib/trips-store";

export type TimeCategory =
  | "driving"
  | "pause"
  | "charging"
  | "meal"
  | "photo"
  | "ferry"
  | "overnight"
  | "other";

export type DurationSource = "default" | "user" | "ai" | "provider";

/** Default minutes per stop type. Easy to tweak in one place. */
export const DEFAULT_STOP_DURATION_MIN: Record<StopType, number> = {
  fuel: 10,
  rest: 15,
  photo: 15,
  viewpoint: 20,
  food: 45,
  attraction: 45,
  city: 45,
  experience: 60,
  detour: 30,
  lodging: 0, // overnight handled separately — does not inflate active day time
  ferry: 30,
};


const FERRY_DEFAULT_MIN = 30;

/** Map a stop type → its time category for budgeting. */
export function inferTimeCategory(stop: Pick<Stop, "type" | "name">): TimeCategory {
  const name = (stop.name ?? "").toLowerCase();
  if (stop.type === "ferry" || /ferge|ferje|ferry/.test(name)) return "ferry";
  switch (stop.type) {
    case "fuel": {
      // Cheap heuristic: a "lading" / "charging" stop should count as charging.
      if (/lade|lading|charg/.test(name)) return "charging";
      return "pause";
    }
    case "food": return "meal";
    case "photo": return "photo";
    case "viewpoint": return "photo";
    case "lodging": return "overnight";
    case "rest": return "pause";
    case "attraction": return "other";
    case "city": return "other";
    case "experience": return "other";
    case "detour": return "other";
    default: return "other";
  }
}


/** Resolve a stop's planned duration in minutes (explicit > default). */
export function inferStopDuration(stop: Stop): number {
  if (typeof stop.durationMin === "number" && stop.durationMin >= 0) {
    return stop.durationMin;
  }
  const cat = inferTimeCategory(stop);
  if (cat === "ferry") return FERRY_DEFAULT_MIN;
  if (cat === "overnight") return 0;
  return DEFAULT_STOP_DURATION_MIN[stop.type] ?? 20;
}

export interface TimeBreakdown {
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

export interface DayTimeBreakdown extends TimeBreakdown {
  dayId: string;
  dayNumber: number;
}

function sumByCat(stops: Stop[], cat: TimeCategory): number {
  return stops
    .filter((s) => inferTimeCategory(s) === cat)
    .reduce((acc, s) => acc + inferStopDuration(s), 0);
}

/** Total driving time for the whole trip, in minutes. */
export function tripDrivingMin(trip: Trip): { min: number; source: TimeBreakdown["source"] } {
  if (typeof trip.routeDurationMin === "number" && trip.routeDurationMin > 0) {
    return { min: trip.routeDurationMin, source: "ors" };
  }
  if (typeof trip.distanceKm === "number" && trip.distanceKm > 0) {
    // Conservative cruise speed; the wizard already uses ~60 km/h as its
    // estimated fallback so we stay consistent.
    return { min: Math.round((trip.distanceKm / 60) * 60), source: "estimated" };
  }
  return { min: 0, source: "estimated" };
}

/** Compute the full trip breakdown from current trip + day + stop state. */
export function computeTimeBreakdown(
  trip: Trip,
  _days: TripDay[],
  stops: Stop[],
): TimeBreakdown {
  const driving = tripDrivingMin(trip);

  const ferryMin = sumByCat(stops, "ferry");
  const chargingMin = sumByCat(stops, "charging");
  const mealMin = sumByCat(stops, "meal");
  const photoMin = sumByCat(stops, "photo");
  const restMin = sumByCat(stops, "pause");
  const otherMin = sumByCat(stops, "other");
  const overnightMin = sumByCat(stops, "overnight");

  const plannedStopsMin =
    chargingMin + mealMin + photoMin + restMin + otherMin;

  // Active day time = driving + ferry + planned pauses, but NOT overnight.
  const totalActiveDayMin = driving.min + ferryMin + plannedStopsMin;
  const totalTripMin = totalActiveDayMin + overnightMin;

  const warnings: string[] = [];
  if (driving.source === "estimated") warnings.push("driving-estimated");
  // We can't reliably split ORS ferry duration today; warn if a lodging stop
  // exists with name matching ferry — caller can surface in debug.
  if (ferryMin === 0 && /ferge|ferje|ferry/i.test(`${trip.origin} ${trip.destination}`)) {
    warnings.push("ferry-possibly-unaccounted");
  }

  return {
    drivingMin: driving.min,
    ferryMin: ferryMin || undefined,
    plannedStopsMin,
    chargingMin: chargingMin || undefined,
    mealMin: mealMin || undefined,
    photoStopMin: photoMin || undefined,
    restMin: restMin || undefined,
    overnightMin: overnightMin || undefined,
    totalActiveDayMin,
    totalTripMin,
    source: driving.source === "ors" && plannedStopsMin > 0 ? "mixed" : driving.source,
    warnings: warnings.length ? warnings : undefined,
  };
}

/** Per-day breakdown. Driving time is distributed proportionally to day count. */
export function computeDayBreakdowns(
  trip: Trip,
  days: TripDay[],
  stops: Stop[],
): DayTimeBreakdown[] {
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  if (sortedDays.length === 0) return [];
  const driving = tripDrivingMin(trip);
  const drivingDays = sortedDays.filter((d) => d.dayDrivingTimeMin !== 0).length || sortedDays.length;
  const drivingPerDay = Math.round(driving.min / drivingDays);

  return sortedDays.map((day) => {
    const dayStops = stops.filter((s) => s.dayId === day.id);
    const ferryMin = sumByCat(dayStops, "ferry");
    const chargingMin = sumByCat(dayStops, "charging");
    const mealMin = sumByCat(dayStops, "meal");
    const photoMin = sumByCat(dayStops, "photo");
    const restMin = sumByCat(dayStops, "pause");
    const otherMin = sumByCat(dayStops, "other");
    const overnightMin = sumByCat(dayStops, "overnight");
    const plannedStopsMin = chargingMin + mealMin + photoMin + restMin + otherMin;
    // Prefer per-day driving time when the wizard stored it (real leg
    // calculation); fall back to evenly-distributed average otherwise.
    const dayDriving = typeof day.dayDrivingTimeMin === "number"
      ? Math.round(day.dayDrivingTimeMin)
      : drivingPerDay;
    const totalActiveDayMin = dayDriving + ferryMin + plannedStopsMin;
    return {
      dayId: day.id,
      dayNumber: day.dayNumber,
      drivingMin: dayDriving,
      ferryMin: ferryMin || undefined,
      plannedStopsMin,
      chargingMin: chargingMin || undefined,
      mealMin: mealMin || undefined,
      photoStopMin: photoMin || undefined,
      restMin: restMin || undefined,
      overnightMin: overnightMin || undefined,
      totalActiveDayMin,
      totalTripMin: totalActiveDayMin + overnightMin,
      source: driving.source === "ors" && plannedStopsMin > 0 ? "mixed" : driving.source,
    };
  });
}

/** Format minutes as "Xt Ymin" / "Ymin". */
export function formatDuration(totalMin: number | undefined | null): string {
  if (totalMin == null || !Number.isFinite(totalMin)) return "—";
  if (totalMin <= 0) return "0 min";
  const min = Math.round(totalMin);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}t` : `${h}t ${m}min`;
}

/** Add minutes to a "HH:MM" string. Returns "HH:MM" or null if parse fails. */
export function addMinutesToHHMM(time: string | undefined, minutes: number): string | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + Math.round(minutes);
  const hh = Math.floor((total % (24 * 60)) / 60).toString().padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
