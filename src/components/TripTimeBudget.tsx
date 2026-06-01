// Trip time v1 — reusable budget panels.
//
// `TripTimeBudget` is the headline summary card (driving / pauses / total),
// `TripDayTimeRow` is a compact per-day row for roadbook + planner.

import type { Trip, TripDay, Stop } from "@/lib/trips-store";
import { tripFuelKind } from "@/lib/trips-store";
import {
  computeTimeBreakdown,
  computeDayBreakdowns,
  formatDuration,
  addMinutesToHHMM,
} from "@/lib/trip-time";
import { Clock, Coffee, BatteryCharging, Ship, Sparkles, Bed, Fuel, Zap } from "lucide-react";
import { CostCalculator } from "@/components/CostCalculator";

interface BudgetProps {
  trip: Trip;
  days: TripDay[];
  stops: Stop[];
  /** When true, also render a per-day breakdown table below the totals. */
  showPerDay?: boolean;
  className?: string;
  title?: string;
}

export function TripTimeBudget({ trip, days, stops, showPerDay, className, title }: BudgetProps) {
  const breakdown = computeTimeBreakdown(trip, days, stops);
  const perDay = showPerDay ? computeDayBreakdowns(trip, days, stops) : [];

  // Routing v1.1 — be honest about what ORS gave us.
  const orsFerryMin = trip.routeFerryDurationMin ?? 0;
  const ferryFromOrs = breakdown.source !== "estimated" && orsFerryMin > 0;
  const drivingLabel = breakdown.source === "estimated" ? "Estimert kjøretid" : "Beregnet kjøretid";
  // We can only call it "Ren kjøretid" when ferries have been excluded from
  // the route — either ORS confirmed no ferry, or the user asked to avoid it.
  const isPureDriving =
    breakdown.source !== "estimated" &&
    (trip.routeAvoidFerries === true || (orsFerryMin === 0 && trip.routeProvider === "ors"));
  const headlineLabel = isPureDriving ? "Ren kjøretid" : drivingLabel;
  const drivingHelper = isPureDriving
    ? null
    : breakdown.source === "estimated"
      ? "Estimat: avstand × 60 km/t."
      : "Fra ruteberegning. Kan inkludere ferge/transporttid der ruten krever det.";

  const rows: { icon: React.ReactNode; label: string; value: string; muted?: boolean }[] = [
    { icon: <Clock className="h-3.5 w-3.5" />, label: headlineLabel, value: formatDuration(breakdown.drivingMin) },
  ];
  if (ferryFromOrs) {
    rows.push({ icon: <Ship className="h-3.5 w-3.5" />, label: "Ferge (inkl. i rutetid)", value: `~${formatDuration(orsFerryMin)}`, muted: true });
  } else if (breakdown.ferryMin) {
    rows.push({ icon: <Ship className="h-3.5 w-3.5" />, label: "Ferge / venting", value: formatDuration(breakdown.ferryMin) });
  }
  if (breakdown.chargingMin) rows.push({ icon: <BatteryCharging className="h-3.5 w-3.5" />, label: "Lading", value: formatDuration(breakdown.chargingMin) });
  if (breakdown.mealMin) rows.push({ icon: <Coffee className="h-3.5 w-3.5" />, label: "Mat", value: formatDuration(breakdown.mealMin) });
  if (breakdown.photoStopMin) rows.push({ icon: <Sparkles className="h-3.5 w-3.5" />, label: "Fotostopp", value: formatDuration(breakdown.photoStopMin) });
  if (breakdown.restMin) rows.push({ icon: <Coffee className="h-3.5 w-3.5" />, label: "Pauser", value: formatDuration(breakdown.restMin) });
  if (breakdown.overnightMin) rows.push({ icon: <Bed className="h-3.5 w-3.5" />, label: "Overnatting", value: formatDuration(breakdown.overnightMin), muted: true });

  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary font-bold">
          <Clock className="h-3.5 w-3.5" /> {title ?? "Tidsbudsjett"}
        </p>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {breakdown.source === "ors" ? "Beregnet" : breakdown.source === "mixed" ? "Beregnet + estimert" : "Estimert"}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.label} className={`flex items-center justify-between gap-3 py-2 text-sm ${r.muted ? "text-muted-foreground" : ""}`}>
            <span className="inline-flex items-center gap-2">{r.icon}<span>{r.label}</span></span>
            <span className="font-mono tabular-nums">{r.value}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 pt-3 mt-1 border-t-2 border-primary/30 text-sm font-semibold">
          <span>Total dagstid</span>
          <span className="font-mono tabular-nums text-primary">{formatDuration(breakdown.totalActiveDayMin)}</span>
        </li>
        {breakdown.overnightMin ? (
          <li className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
            <span>Inkl. overnatting</span>
            <span className="font-mono tabular-nums">{formatDuration(breakdown.totalTripMin)}</span>
          </li>
        ) : null}
      </ul>

      <CostCalculator trip={trip} stops={stops} />




      {drivingHelper && (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{drivingHelper}</p>
      )}
      {trip.routeAvoidHighways && (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Ruten unngår motorvei (valgt kjørestil). Det forklarer at tiden kan være lengre enn raskeste vei.
        </p>
      )}

      {showPerDay && perDay.length > 1 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Per dag</p>
          <ul className="space-y-1.5">
            {perDay.map((d) => (
              <li key={d.dayId} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Dag {d.dayNumber}</span>
                <span className="font-mono tabular-nums">
                  <span className="text-foreground/70">{formatDuration(d.drivingMin)}</span>
                  <span className="text-muted-foreground"> + </span>
                  <span className="text-foreground/70">{formatDuration(d.plannedStopsMin + (d.ferryMin ?? 0))}</span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="text-primary font-semibold">{formatDuration(d.totalActiveDayMin)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface DayRowProps {
  trip: Trip;
  days: TripDay[];
  stops: Stop[];
  dayId: string;
  /** Optional clock value to start the day from, e.g. "08:30". */
  startTime?: string;
}

/** Compact "kjøring · pauser · total · → arr" row for the roadbook. */
export function TripDayTimeRow({ trip, days, stops, dayId, startTime }: DayRowProps) {
  const perDay = computeDayBreakdowns(trip, days, stops);
  const row = perDay.find((d) => d.dayId === dayId);
  if (!row) return null;
  const arr = addMinutesToHHMM(startTime, row.totalActiveDayMin);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
      <span className="inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> Kjøring <span className="text-foreground font-semibold normal-case tracking-normal">{formatDuration(row.drivingMin)}</span></span>
      <span className="inline-flex items-center gap-1.5"><Coffee className="h-3 w-3" /> Pauser <span className="text-foreground font-semibold normal-case tracking-normal">{formatDuration(row.plannedStopsMin + (row.ferryMin ?? 0))}</span></span>
      <span className="inline-flex items-center gap-1.5">Total <span className="text-primary font-semibold normal-case tracking-normal">{formatDuration(row.totalActiveDayMin)}</span></span>
      {startTime && arr && (
        <span className="inline-flex items-center gap-1.5">Start {startTime} → Antatt ankomst <span className="text-foreground font-semibold normal-case tracking-normal">{arr}</span></span>
      )}
    </div>
  );
}

