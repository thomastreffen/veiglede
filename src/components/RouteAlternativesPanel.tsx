import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Route as RouteIcon, ChevronDown, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; count: number };

export function RouteAlternativesPanel({ trip }: Props) {
  const [open, setOpen] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const inFlight = useRef<string | null>(null);

  const hash = useMemo(
    () => hashFor(trip),
    [trip.originLoc, trip.destinationLoc, trip.shapingWaypoints, trip.vehicle, trip.style],
  );
  const cacheValid =
    !!trip.routeAlternatives &&
    trip.routeAlternatives.length > 0 &&
    trip.routeAlternativesHash === hash;

  const runFetch = useCallback(
    (force = false) => {
      if (!trip.originLoc || !trip.destinationLoc) return;
      if (!force && cacheValid) return;
      if (inFlight.current === hash && !force) return;
      inFlight.current = hash;
      setFetchState({ kind: "loading" });
      getRouteAlternatives({
        origin: trip.originLoc,
        destination: trip.destinationLoc,
        waypoints: (trip.shapingWaypoints ?? []).map((w) => ({ lat: w.lat, lng: w.lng })),
        vehicleType: trip.vehicle,
        routeStyle: trip.style,
      })
        .then((res) => {
          const fastestMin = res.routes.reduce((m, r) => (r.durationMin < m ? r.durationMin : m), Infinity);
          const fastestIdx = res.routes.findIndex((x) => x.durationMin === fastestMin);
          const alts: RouteAlternative[] = res.routes.map((r, i) => {
            const isFastest = i === fastestIdx;
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
          setFetchState({ kind: "ok", count: alts.length });
        })
        .catch((e) => setFetchState({ kind: "error", message: (e as Error)?.message ?? "Ukjent feil" }))
        .finally(() => {
          inFlight.current = null;
        });
    },
    [trip.id, trip.originLoc, trip.destinationLoc, trip.shapingWaypoints, trip.vehicle, trip.style, hash, cacheValid],
  );

  // Auto-fetch når brukeren åpner panelet og cachen mangler/er utdatert.
  useEffect(() => {
    if (!open) return;
    if (cacheValid) {
      setFetchState({ kind: "ok", count: trip.routeAlternatives?.length ?? 0 });
      return;
    }
    runFetch(false);
  }, [open, cacheValid, runFetch, trip.routeAlternatives?.length]);

  const alts = cacheValid ? trip.routeAlternatives ?? [] : [];
  const fastestId = alts.find((a) => a.isFastest)?.id ?? alts[0]?.id;
  // Fallback: hvis selectedRouteAltId peker til noe som ikke finnes -> raskeste.
  const selectedId =
    trip.selectedRouteAltId && alts.some((a) => a.id === trip.selectedRouteAltId)
      ? trip.selectedRouteAltId
      : fastestId;
  const hasMultiple = alts.length > 1;

  const onSelect = (alt: RouteAlternative) => {
    tripsApi.selectRouteAlternative(trip.id, alt.id);
    toast.success(`Bytter til "${alt.label}" (${Math.round(alt.distanceKm)} km, ${formatDuration(alt.durationMin)})`);
  };

  if (!trip.originLoc || !trip.destinationLoc) return null;

  const headerBadge = (() => {
    if (fetchState.kind === "loading") return "Laster…";
    if (fetchState.kind === "error") return "Feil";
    if (hasMultiple) return `${alts.length} alternativer`;
    if (alts.length === 1) return "Bare én rute";
    return null;
  })();

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
          {headerBadge && (
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal">
              {headerBadge}
            </span>
          )}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {fetchState.kind === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="size-4 animate-spin" /> Henter alternative ruter…
            </div>
          )}

          {fetchState.kind === "error" && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 mt-0.5 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Kunne ikke hente alternative ruter</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fetchState.message}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => runFetch(true)}>
                <RefreshCw className="size-3.5" /> Forsøk på nytt
              </Button>
            </div>
          )}

          {fetchState.kind !== "loading" && fetchState.kind !== "error" && alts.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Ingen alternative ruter funnet for denne strekningen.
            </p>
          )}

          {fetchState.kind !== "loading" && fetchState.kind !== "error" && alts.length === 1 && (
            <p className="text-sm text-muted-foreground py-1">
              Kun én naturlig rute finnes mellom start og mål. Legg inn et via-punkt for å tvinge frem alternativer.
            </p>
          )}

          {alts.length > 0 && (
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{alt.label}</span>
                            {alt.isFastest && (
                              <span className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                                Raskest
                              </span>
                            )}
                            {isSelected && (
                              <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                                Valgt
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
                          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                            {isSelected ? "✓ Valgt" : "Velg denne veien →"}
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

          <div className="pt-2 border-t border-border/60 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Valgt rute brukes til kart, kjøretid og kostnader. Valget lagres automatisk.
            </p>
            <p className="text-[11px] text-muted-foreground italic">
              Dra/klikk for å tilpasse ruten direkte i kartet kommer i neste versjon.
            </p>
            {alts.length > 0 && (
              <button
                type="button"
                onClick={() => runFetch(true)}
                className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="size-3" /> Hent alternativer på nytt
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default RouteAlternativesPanel;
