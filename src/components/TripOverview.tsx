// TripOverview v1 — at-a-glance OVERSIKT for a planned trip.
//
// Renders a trip summary card on top + a per-day vertical timeline below.
// Clicking a stop dot scrolls the matching stop card in DAG FOR DAG into view.
// Per-day cost breakdown lives at the bottom of each day card.

import { useMemo } from "react";
import {
  Route as RouteIcon, Clock, Bed, Ship, MapPin, Wallet, Sparkles,
  Fuel, Zap, Calculator,
} from "lucide-react";
import type { Trip, TripDay, Stop } from "@/lib/trips-store";
import { tripFuelKind, stopDisplayMeta, computeEnergyCost } from "@/lib/trips-store";
import {
  computeTimeBreakdown,
  computeDayBreakdowns,
  formatDuration,
  addMinutesToHHMM,
  inferTimeCategory,
} from "@/lib/trip-time";
import { useT } from "@/i18n/provider";

interface Props {
  trip: Trip;
  days: TripDay[];
  stops: Stop[];
}

function fmtNok(n: number): string {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

/** Per-stop dot color by category. */
function dotClass(stop: Stop): string {
  const cat = inferTimeCategory(stop);
  switch (cat) {
    case "overnight": return "bg-blue-400 ring-blue-400/30";
    case "ferry":     return "bg-slate-400 ring-slate-400/30";
    case "meal":      return "bg-emerald-400 ring-emerald-400/30";
    case "charging":  return "bg-yellow-400 ring-yellow-400/30";
    case "photo":     return "bg-teal-400 ring-teal-400/30";
    default:          return "bg-primary ring-primary/30";
  }
}

interface DayCostRow {
  dayId: string;
  dayNumber: number;
  km: number;
  energyCost: number;
  lodgingCost: number;
  ferryCost: number;
  total: number;
}

function computeDayCosts(trip: Trip, days: TripDay[], stops: Stop[]): DayCostRow[] {
  const cs = trip.costSettings ?? {};
  const kind = tripFuelKind(trip);
  const isElectric = kind === "electric";
  const consumption = cs.fuelConsumptionPer100km ?? (isElectric ? 18 : trip.vehicle === "rv" ? 14 : trip.vehicle === "motorcycle" ? 5 : 8);
  const price = isElectric
    ? (cs.electricityPricePerKwh ?? 3.5)
    : (cs.fuelPricePerLiter ?? (trip.vehicle === "motorcycle" ? 22 : 20));

  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const totalKm = trip.distanceKm ?? trip.routeDistanceKm ?? 0;
  const perDayKmFallback = sortedDays.length > 0 ? totalKm / sortedDays.length : 0;

  return sortedDays.map((day) => {
    const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
    const stopsKm = dayStops.reduce((acc, s) => acc + (s.distanceFromPrevKm ?? 0), 0);
    const dayKm = day.dayDistanceKm ?? (stopsKm > 0 ? stopsKm : perDayKmFallback);
    const energyCost = computeEnergyCost(dayKm, consumption, price, `day ${day.dayNumber}`);
    const lodgingCost = dayStops
      .filter((s) => s.type === "lodging" && s.booking?.pricePerNight)
      .reduce((acc, s) => acc + (s.booking!.pricePerNight! * (s.booking!.nights ?? 1)), 0);
    const ferryCost = dayStops
      .filter((s) => s.type === "ferry" && s.ferryCostNok)
      .reduce((acc, s) => acc + (s.ferryCostNok ?? 0), 0);
    return {
      dayId: day.id,
      dayNumber: day.dayNumber,
      km: Math.round(dayKm),
      energyCost,
      lodgingCost,
      ferryCost,
      total: energyCost + lodgingCost + ferryCost,
    };
  });
}

function scrollToStop(stopId: string) {
  const el = document.getElementById(`stop-${stopId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-primary");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1600);
}

export function TripOverview({ trip, days, stops }: Props) {
  const t = useT();
  const ov = t.app.tripDetail.overview;
  const breakdown = useMemo(() => computeTimeBreakdown(trip, days, stops), [trip, days, stops]);
  const perDayTime = useMemo(() => computeDayBreakdowns(trip, days, stops), [trip, days, stops]);
  const dayCosts = useMemo(() => computeDayCosts(trip, days, stops), [trip, days, stops]);

  const overnights = stops
    .filter((s) => s.type === "lodging")
    .reduce((acc, s) => acc + (s.booking?.nights ?? 1), 0);
  const ferries = stops.filter((s) => s.type === "ferry").length;
  const totalCost = dayCosts.reduce((a, d) => a + d.total, 0);
  const isElectric = tripFuelKind(trip) === "electric";
  const EnergyIcon = isElectric ? Zap : Fuel;
  const people = Math.max(1, trip.costSettings?.people ?? 1);
  const regions = Array.from(new Set(stops.map((s) => s.location).filter(Boolean))).slice(0, 5);

  return (
    <div className="trip-overview">
      {/* Summary card */}
      <section className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-surface to-surface p-5 md:p-6 shadow-lg">
        <div className="flex items-baseline justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary font-bold">
            <Sparkles className="h-3.5 w-3.5" /> {ov.title}
          </p>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {days.length} {days.length === 1 ? ov.daysSingular : ov.daysPlural}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<RouteIcon className="h-4 w-4" />} label={ov.distance} value={`${trip.distanceKm} km`} />
          <Stat icon={<Clock className="h-4 w-4" />} label={ov.drivingTime} value={formatDuration(breakdown.drivingMin)} />
          <Stat icon={<Bed className="h-4 w-4" />} label={ov.overnights} value={String(overnights)} />
          <Stat icon={<Ship className="h-4 w-4" />} label={ov.ferries} value={String(ferries)} />
        </div>

        <div className="mt-4 pt-3 border-t border-border/60 flex items-baseline justify-between flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> {ov.totalEstimate}
          </span>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary font-mono tabular-nums">ca. {fmtNok(totalCost)}</p>
            {people > 1 && (
              <p className="text-[11px] text-muted-foreground">{ov.perPerson}: {fmtNok(totalCost / people)}</p>
            )}
          </div>
        </div>

        {regions.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
            <MapPin className="h-3 w-3" />
            {regions.join(" · ")}
          </p>
        )}
      </section>

      {/* Per-day timeline */}
      <div className="mt-4 space-y-3">
        {perDayTime.map((dayT) => {
          const day = days.find((d) => d.id === dayT.dayId);
          if (!day) return null;
          const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
          const cost = dayCosts.find((c) => c.dayId === day.id);
          const arrival = day.departureTime
            ? addMinutesToHHMM(day.departureTime, dayT.totalActiveDayMin)
            : null;
          const hasLodging = dayStops.some((s) => s.type === "lodging");
          const hasFerry = dayStops.some((s) => s.type === "ferry");

          return (
            <article
              key={day.id}
              className="trip-overview-day rounded-2xl border border-border bg-surface p-4 md:grid md:grid-cols-[1fr_1.4fr_1fr] md:gap-5 md:items-start"
            >
              <header className="md:pr-4 md:border-r md:border-border/60">
                <div className="flex items-center gap-2">
                  <span className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display text-lg shrink-0">
                    {day.dayNumber}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-base uppercase truncate">{day.title}</p>
                    {day.date && (
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(day.date + "T12:00:00").toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hasLodging && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      <Bed className="h-3 w-3" /> {ov.lodgingBadge}
                    </span>
                  )}
                  {hasFerry && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-400/40 bg-slate-400/10 text-slate-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      <Ship className="h-3 w-3" /> {ov.ferryBadge}
                    </span>
                  )}
                  {cost?.km === 0 && dayT.totalActiveDayMin === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background text-muted-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      😴 Hviledag
                    </span>
                  )}
                </div>
                {day.departureTime && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {arrival ? ov.departureToArrival(day.departureTime, arrival) : ov.departureOnly(day.departureTime)}
                  </p>
                )}
              </header>

              <div className="mt-4 md:mt-0 md:px-2 relative">
                {dayStops.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">{ov.noStopsToday}</p>
                ) : (
                  <ol className="relative border-l-2 border-border/60 ml-1.5 space-y-2.5">
                    {dayStops.map((stop) => {
                      const meta = stopDisplayMeta(stop);
                      return (
                        <li key={stop.id} className="relative pl-4">
                          <button
                            type="button"
                            onClick={() => scrollToStop(stop.id)}
                            className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ${dotClass(stop)} hover:scale-125 transition-transform`}
                            title={ov.jumpToStop}
                            aria-label={`${ov.jumpToStop}: ${stop.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => scrollToStop(stop.id)}
                            className="text-left text-xs hover:text-primary group block w-full"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-sm">{meta.emoji}</span>
                              <span className="font-medium truncate group-hover:underline">{stop.name}</span>
                            </span>
                            {stop.durationMin ? (
                              <span className="block text-[10px] text-muted-foreground mt-0.5">
                                {formatDuration(stop.durationMin)}
                                {stop.distanceFromPrevKm ? ` · +${stop.distanceFromPrevKm} km` : ""}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <aside className="mt-4 md:mt-0 md:pl-4 md:border-l md:border-border/60">
                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground"><RouteIcon className="h-3 w-3" />{ov.km}</span>
                    <span className="font-mono tabular-nums">{cost?.km ?? 0} km</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3 w-3" />{ov.totalTime}</span>
                    <span className="font-mono tabular-nums">{formatDuration(dayT.totalActiveDayMin)}</span>
                  </li>
                  {cost && cost.energyCost > 0 && (
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><EnergyIcon className="h-3 w-3" />{isElectric ? ov.charging : ov.fuel}</span>
                      <span className="font-mono tabular-nums">ca. {fmtNok(cost.energyCost)}</span>
                    </li>
                  )}
                  {cost && cost.lodgingCost > 0 && (
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Bed className="h-3 w-3" />{ov.lodging}</span>
                      <span className="font-mono tabular-nums">ca. {fmtNok(cost.lodgingCost)}</span>
                    </li>
                  )}
                  {cost && cost.ferryCost > 0 && (
                    <li className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Ship className="h-3 w-3" />{ov.ferry}</span>
                      <span className="font-mono tabular-nums">ca. {fmtNok(cost.ferryCost)}</span>
                    </li>
                  )}
                  {cost && (
                    <li className="flex items-center justify-between pt-1.5 mt-1 border-t border-border/60 text-sm font-semibold">
                      <span className="inline-flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5" />{ov.sum}</span>
                      <span className="font-mono tabular-nums text-primary">ca. {fmtNok(cost.total)}</span>
                    </li>
                  )}
                </ul>
              </aside>
            </article>
          );
        })}
      </div>

      {/* Grand total */}
      <section className="mt-4 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 flex items-baseline justify-between flex-wrap gap-2 print:break-inside-avoid">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-semibold">
          <Calculator className="h-4 w-4" /> {ov.totalTrip}
        </span>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary font-mono tabular-nums">ca. {fmtNok(totalCost)}</p>
          {people > 1 && (
            <p className="text-[11px] text-muted-foreground">{ov.sharedAmong(people, fmtNok(totalCost / people))}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-lg font-semibold font-mono tabular-nums">{value}</p>
    </div>
  );
}
