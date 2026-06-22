import { useEffect, useMemo, useRef, useState } from "react";
import { Route as RouteIcon, ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tripsApi, type RouteAlternative, type Trip } from "@/lib/trips-store";
import { getRouteAlternatives } from "@/lib/routing";

interface Props {
  trip: Trip;
}

function formatDuration(min: number): string {
  if (!min || min < 1) return "0 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

function deriveLabel(alt: { routeLabels?: string[]; description?: string }, index: number, isFastest: boolean): string {
  const labels = alt.routeLabels ?? [];
  if (isFastest) return "Raskeste vei";
  if (labels.includes("FUEL_EFFICIENT")) return "Mest drivstoffeffektive";
  if (alt.description && alt.description.length < 60) return alt.description;
  return `Alternativ ${index + 1}`;
}

function deriveDescription(alt: { routeLabels?: string[]; description?: string }): string | undefined {
  if (alt.description && alt.description.length < 120) return alt.description;
  const labels = alt.routeLabels ?? [];
  if (labels.includes("FUEL_EFFICIENT")) return "Lavere drivstoff-/energiforbruk";
  if (labels.includes("DEFAULT_ROUTE_ALTERNATE")) return "Alternativt veivalg";
  return undefined;
}

function hashFor(trip: Trip): string {
  const o = trip.originLoc;
  const d = trip.destinationLoc;
  if (!o || !d) return "";
  const shaping = (trip.shapingWaypoints ?? [])
    .map((w) => `${w.lat.toFixed(4)},${w.lng.toFixed(4)}`)
    .join("|");
  return [
    `${o.lat.toFixed(4)},${o.lng.toFixed(4)}`,
    `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`,
    shaping,
    trip.vehicle ?? "",
    trip.style ?? "",
  ].join("::");
}

export function RouteAlternativesPanel({ trip }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  const hash = useMemo(() => hashFor(trip), [trip.originLoc, trip.destinationLoc, trip.shapingWaypoints, trip.vehicle, trip.style]);
  const haveCache = !!trip.routeAlternatives && trip.routeAlternatives.length > 0 && trip.routeAlternativesHash === hash;

  useEffect(() => {
    if (!open) return;
    if (!trip.originLoc || !trip.destinationLoc) return;
    if (haveCache) return;
    if (inFlight.current === hash) return;
    inFlight.current = hash;
    setLoading(true);
    setError(null);
    getRouteAlternatives({
      origin: trip.originLoc,
      destination: trip.destinationLoc,
      waypoints: (trip.shapingWaypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng })),
      vehicleType: trip.vehicle,
      routeStyle: trip.style,
    })
      .then((res) => {
        const fastestMin = res.routes.reduce((m, r) => (r.durationMin < m ? r.durationMin : m), Infinity);
        const alts: RouteAlternative[] = res.routes.map((r, i) => {
          const isFastest = r.durationMin === fastestMin && i === res.routes.findIndex((x) => x.durationMin === fastestMin);
          return {
            id: `alt-${i}`,
            label: deriveLabel(r, i, isFastest),
            description: deriveDescription(r),
            distanceKm: r.distanceKm,
            durationMin: r.durationMin,
            geometry: r.geometry,
            provider: r.provider,
            isFastest,
            deltaMinFromFastest: Math.max(0, r.durationMin - fastestMin),
            source: res.routes.length > 1 ? "google-alt" : "fallback",
          };
        });
        tripsApi.setRouteAlternatives(trip.id, alts, hash);
      })
      .catch((e) => setError((e as Error)?.message ?? "Ukjent feil"))
      .finally(() => {
        setLoading(false);
        inFlight.current = null;
      });
  }, [open, hash, haveCache, trip.id, trip.originLoc, trip.destinationLoc, trip.shapingWaypoints, trip.vehicle, trip.style]);

  const alts = haveCache ? trip.routeAlternatives ?? [] : [];
  const selectedId = trip.selectedRouteAltId ?? (alts.find((a) => a.isFastest)?.id ?? alts[0]?.id);
  const hasMultiple = alts.length > 1;

  const onSelect = (alt: RouteAlternative) => {
    tripsApi.selectRouteAlternative(trip.id, alt.id);
    toast.success(`Bytter til "${alt.label}" (${Math.round(alt.distanceKm)} km, ${formatDuration(alt.durationMin)})`);
  };

  if (!trip.originLoc || !trip.destinationLoc) return null;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <RouteIcon className="size-4" /> Velg annen vei
          {hasMultiple && (
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal">
              {alts.length} alternativer
            </span>
          )}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Henter alternative ruter…
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-destructive">Kunne ikke hente alternativer: {error}</p>
          )}
          {!loading && !error && alts.length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen alternativer funnet for denne strekningen.</p>
          )}
          {!loading && alts.length > 0 && (
            <ul className="space-y-2">
              {alts.map((alt) => {
                const isSelected = alt.id === selectedId;
                const delta = alt.deltaMinFromFastest ?? 0;
                return (
                  <li key={alt.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(alt)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alt.label}</span>
                            {alt.isFastest && (
                              <span className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                                Raskest
                              </span>
                            )}
                          </div>
                          {alt.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{alt.description}</p>
                          )}
                          <p className="mt-1 text-sm tabular-nums">
                            {Math.round(alt.distanceKm)} km · {formatDuration(alt.durationMin)}
                            {delta > 0 && (
                              <span className="ml-2 text-amber-600 dark:text-amber-400">+{formatDuration(delta)}</span>
                            )}
                          </p>
                        </div>
                        {isSelected && <Check className="size-5 text-primary shrink-0" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground pt-1">
            Valgt rute brukes til kart, kjøretid og kostnader. Valget lagres automatisk.
            {(trip.shapingWaypoints?.length ?? 0) === 0 && hasMultiple === false && !loading && alts.length > 0 && (
              <> Få frem flere veivalg ved å legge inn et via-punkt (kommer).</>
            )}
          </p>
        </div>
      )}
    </Card>
  );
}

export default RouteAlternativesPanel;
