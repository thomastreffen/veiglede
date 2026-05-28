import * as React from "react";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Trip, TripDay, Stop } from "@/lib/trips-store";
import type { LatLng } from "@/lib/geo";
import { projectTrip, lookupPlace } from "@/lib/geo";
import { stopMeta } from "@/lib/trips-store";
import { useRuntimeMapConfig } from "@/lib/map/runtime-config";
import { useDebugMode } from "@/components/DemoDebugPanel";
import { cn } from "@/lib/utils";

// Lazy-load the real (MapLibre) renderer so the heavy dep is only paid
// for when MapTiler is actually configured.
type RealMapProps = Props & { maptilerKey: string; onError?: (msg?: string) => void; onReady?: () => void };
const MapLibreTripMap = lazy(() =>
  import("./map/MapLibreTripMap")
    .then((m) => ({ default: m.MapLibreTripMap as React.ComponentType<RealMapProps> }))
    // If the chunk fails to load (e.g. network), render nothing — SVG base stays visible.
    .catch(() => ({ default: () => null })),
);


interface Props {
  trip: Trip;
  days: TripDay[];
  stops: Stop[];
  selectedStopId?: string | null;
  onSelectStop?: (stopId: string | null) => void;
  height?: string;
  className?: string;
  // Optional pins for "langs ruta" suggestions to preview where they sit.
  suggestionPins?: { id: string; name: string; loc: LatLng; emoji: string }[];
  hoveredSuggestionId?: string | null;
  compact?: boolean;
}

// Mercator-ish projection helpers (simple linear — Norway is small enough).
function projectToView(
  point: LatLng,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  width: number,
  height: number,
  padding: number,
) {
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const lngSpan = bounds.maxLng - bounds.minLng || 0.01;
  const latSpan = bounds.maxLat - bounds.minLat || 0.01;
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180;
  const lngScale = Math.cos(midLat);
  const adjLngSpan = lngSpan * lngScale || 0.01;
  const scale = Math.min(innerW / adjLngSpan, innerH / latSpan);
  const centerX = width / 2;
  const centerY = height / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const x = centerX + (point.lng - centerLng) * lngScale * scale;
  const y = centerY - (point.lat - centerLat) * scale;
  return { x, y };
}

const DAY_COLORS = [
  "oklch(0.78 0.17 65)",
  "oklch(0.75 0.16 200)",
  "oklch(0.72 0.18 140)",
  "oklch(0.70 0.20 320)",
  "oklch(0.78 0.14 90)",
];

/**
 * TripMap — provider-agnostic trip map.
 *
 * Always renders the SVG base immediately so the container is never empty.
 * When MapTiler is configured and reachable, MapLibre is overlaid on top
 * and the SVG underneath becomes the silent fallback.
 */
export function TripMap(props: Props) {
  const [errored, setErrored] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [maplibreReady, setMaplibreReady] = useState(false);
  const cfg = useRuntimeMapConfig();
  const debug = useDebugMode();

  const hasOrigin = Boolean(props.trip.originLoc) || Boolean(lookupPlace(props.trip.origin));
  const hasDestination = Boolean(props.trip.destinationLoc) || Boolean(lookupPlace(props.trip.destination));
  const hasUsableCoords = hasOrigin || hasDestination;

  const useMapLibre = Boolean(cfg?.hasRealMap && cfg.maptilerKey && !errored && hasUsableCoords);
  const mode = !hasUsableCoords
    ? "missing"
    : useMapLibre
      ? (maplibreReady ? "maptiler" : "loading-maptiler")
      : "svg";

  const routePointCount = props.days.length + 2;
  const stopsWithCoords = props.stops.filter((s) => lookupPlace(s.location ?? s.name)).length;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[TripMap]", {
      runtimeConfigLoaded: cfg !== null,
      hasRealMap: cfg?.hasRealMap ?? false,
      mode,
      maplibreReady,
      errored,
      errorMsg,
      hasOrigin, hasDestination,
    });
  }

  // Always render SVG as the base layer. This guarantees the container is
  // never empty, even while MapLibre is still fetching the style or if it
  // fails silently.
  return (
    <div className={cn("relative", props.className)}>
      <SvgTripMap {...props} className={undefined} />
      {useMapLibre && (
        <div
          aria-hidden={!maplibreReady}
          className={cn(
            "absolute inset-0 rounded-2xl overflow-hidden transition-opacity duration-300 bg-transparent",
            maplibreReady ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          )}
        >
          <Suspense fallback={null}>
            <MapLibreTripMap
              {...props}
              className={undefined}
              maptilerKey={cfg!.maptilerKey!}
              onReady={() => setMaplibreReady(true)}
              onError={(msg) => { setErrored(true); setErrorMsg(msg ?? "unknown"); setMaplibreReady(false); }}
            />
          </Suspense>
        </div>
      )}
      {debug && (
        <div className="absolute left-2 top-2 z-10 pointer-events-none rounded-md border border-primary/40 bg-background/85 backdrop-blur px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/90 space-y-0.5">
          <div>mode: <span className="text-primary font-semibold">{mode}</span></div>
          <div>overlay: {String(useMapLibre && maplibreReady)} · ready: {String(maplibreReady)}</div>
          <div>real: {String(cfg?.hasRealMap ?? false)} · pts: {routePointCount} · stops: {stopsWithCoords}/{props.stops.length}</div>
          {errorMsg && <div className="text-destructive normal-case">err: {errorMsg}</div>}
        </div>
      )}
    </div>
  );
}


function SvgTripMap({
  trip,
  days,
  stops,
  selectedStopId,
  onSelectStop,
  height = "h-64",
  className,
  suggestionPins = [],
  hoveredSuggestionId,
  compact = false,
}: Props) {
  const projected = useMemo(() => projectTrip(trip, days, stops), [trip, days, stops]);

  // Measure the actual rendered card so the projection fits the visible area
  // instead of relying on a fixed 800×480 viewBox + `slice` (which clipped
  // vertical routes like Drammen → Molde at the top/bottom of wide cards).
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 480 });
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(120, Math.round(rect.width));
      const h = Math.max(120, Math.round(rect.height));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const W = size.w;
  const H = size.h;
  // Bigger pad on the short axis so pins/labels don't sit on the card edge.
  const padding = Math.max(compact ? 24 : 40, Math.round(Math.min(W, H) * 0.12));

  const bounds = useMemo(() => {
    const all: LatLng[] = [
      projected.origin,
      projected.destination,
      ...projected.mapped.map((m) => m.loc),
      ...suggestionPins.map((p) => p.loc),
    ];
    const lats = all.map((p) => p.lat);
    const lngs = all.map((p) => p.lng);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    // Tiny padding so points don't sit on the edge.
    const padLat = Math.max(0.05, (maxLat - minLat) * 0.12);
    const padLng = Math.max(0.05, (maxLng - minLng) * 0.12);
    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    };
  }, [projected, suggestionPins]);

  const project = (p: LatLng) => projectToView(p, bounds, W, H, padding);

  const originPt = project(projected.origin);
  const destPt = project(projected.destination);

  // Build per-day polyline segments
  const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const segments = sortedDays.map((day, dayIdx) => {
    const dayMapped = projected.mapped.filter((m) => m.day.id === day.id);
    const dayPoints: LatLng[] = [];
    // Connect previous day's last point (or origin) → this day's stops → next day's first (or destination handled at end)
    if (dayIdx === 0) dayPoints.push(projected.origin);
    else {
      const prevDay = projected.mapped.filter((m) => m.day.id === sortedDays[dayIdx - 1].id);
      if (prevDay.length) dayPoints.push(prevDay[prevDay.length - 1].loc);
      else dayPoints.push(projected.origin);
    }
    dayMapped.forEach((m) => dayPoints.push(m.loc));
    // For the final day, close with destination
    if (dayIdx === sortedDays.length - 1) dayPoints.push(projected.destination);
    return {
      day,
      dayIdx,
      points: dayPoints.map(project),
      color: DAY_COLORS[dayIdx % DAY_COLORS.length],
    };
  });

  // Empty-state fallback path: straight origin→destination
  const fallbackPath = sortedDays.length === 0
    ? `M${originPt.x},${originPt.y} L${destPt.x},${destPt.y}`
    : null;

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden rounded-2xl border border-border bg-surface", height, className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="vg-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.28 0.014 250)" strokeWidth="0.6" />
          </pattern>
          <linearGradient id="vg-map-bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.20 0.015 250)" />
            <stop offset="100%" stopColor="oklch(0.14 0.012 250)" />
          </linearGradient>
          <radialGradient id="vg-map-glow" cx="20%" cy="10%" r="60%">
            <stop offset="0%" stopColor="oklch(0.78 0.17 65 / 0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="vg-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#vg-map-bg)" />
        <rect width={W} height={H} fill="url(#vg-map-grid)" opacity="0.55" />
        <rect width={W} height={H} fill="url(#vg-map-glow)" />

        {/* Terrain-y hints — soft blobs so the map feels alive */}
        <g opacity="0.4">
          <ellipse cx={W * 0.3} cy={H * 0.4} rx={140} ry={70} fill="oklch(0.24 0.018 250)" />
          <ellipse cx={W * 0.7} cy={H * 0.6} rx={180} ry={90} fill="oklch(0.22 0.018 250)" />
          <ellipse cx={W * 0.5} cy={H * 0.75} rx={220} ry={60} fill="oklch(0.20 0.016 250)" />
        </g>

        {/* Day-colored route segments */}
        {fallbackPath && (
          <path d={fallbackPath} fill="none" stroke="oklch(0.78 0.17 65)" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
        )}
        {segments.map((seg) => {
          if (seg.points.length < 2) return null;
          const d = seg.points
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(" ");
          return (
            <g key={seg.day.id}>
              {/* glow */}
              <path d={d} fill="none" stroke={seg.color} strokeWidth="10" opacity="0.18" strokeLinecap="round" filter="url(#vg-soft-glow)" />
              {/* main line */}
              <path d={d} fill="none" stroke={seg.color} strokeWidth={compact ? 2.5 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}

        {/* Suggestion pins (semi-transparent until hovered) */}
        {suggestionPins.map((p) => {
          const pt = project(p.loc);
          const active = hoveredSuggestionId === p.id;
          return (
            <g key={p.id} opacity={active ? 1 : 0.55}>
              <circle cx={pt.x} cy={pt.y} r={active ? 12 : 8} fill="none" stroke="oklch(0.85 0.14 90)" strokeWidth="2" strokeDasharray="3 3" />
              <text x={pt.x} y={pt.y + 5} textAnchor="middle" fontSize={active ? 14 : 11}>{p.emoji}</text>
            </g>
          );
        })}

        {/* Stop pins */}
        {projected.mapped.map((m) => {
          const pt = project(m.loc);
          const meta = stopMeta(m.stop.type);
          const color = DAY_COLORS[m.dayIndex % DAY_COLORS.length];
          const selected = selectedStopId === m.stop.id;
          const r = selected ? 16 : compact ? 9 : 12;
          return (
            <g
              key={m.stop.id}
              className="cursor-pointer"
              onClick={() => onSelectStop?.(selected ? null : m.stop.id)}
            >
              {selected && (
                <circle cx={pt.x} cy={pt.y} r={r + 10} fill={color} opacity="0.2" />
              )}
              <circle cx={pt.x} cy={pt.y} r={r + 2} fill="oklch(0.14 0.012 250)" />
              <circle cx={pt.x} cy={pt.y} r={r} fill={color} stroke="oklch(0.95 0.02 250)" strokeWidth={selected ? 2.5 : 1.5} />
              <text x={pt.x} y={pt.y + (selected ? 6 : 4)} textAnchor="middle" fontSize={selected ? 16 : compact ? 10 : 13} style={{ pointerEvents: "none" }}>{meta.emoji}</text>
              {selected && !compact && (
                <g>
                  <rect x={pt.x + 18} y={pt.y - 22} rx="6" ry="6" width={Math.min(220, m.stop.name.length * 8 + 24)} height="26" fill="oklch(0.14 0.012 250)" stroke={color} strokeWidth="1" />
                  <text x={pt.x + 30} y={pt.y - 4} fontSize="13" fill="oklch(0.95 0.02 250)">{m.stop.name}</text>
                </g>
              )}
              {m.approximated && !selected && (
                <circle cx={pt.x + r + 1} cy={pt.y - r - 1} r="3" fill="oklch(0.55 0.02 250)" />
              )}
            </g>
          );
        })}

        {/* Origin marker */}
        <g>
          <circle cx={originPt.x} cy={originPt.y} r="14" fill="oklch(0.95 0.02 250)" />
          <circle cx={originPt.x} cy={originPt.y} r="9" fill="oklch(0.78 0.17 65)" />
          <text x={originPt.x} y={originPt.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="oklch(0.14 0.012 250)">A</text>
        </g>
        {/* Destination marker */}
        <g>
          <circle cx={destPt.x} cy={destPt.y} r="14" fill="oklch(0.95 0.02 250)" />
          <circle cx={destPt.x} cy={destPt.y} r="9" fill="oklch(0.85 0.16 85)" />
          <text x={destPt.x} y={destPt.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="oklch(0.14 0.012 250)">B</text>
        </g>
      </svg>

      {/* Overlay labels — origin + destination */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-3">
        <span className="rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/90 border border-border">
          A · {projected.originName}
        </span>
        <span className="rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[10px] uppercase tracking-wider text-foreground/90 border border-border">
          {projected.destinationName} · B
        </span>
      </div>

      {/* Legend / day chips */}
      {!compact && sortedDays.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-3 flex-wrap">
          <div className="flex flex-wrap gap-1.5">
            {sortedDays.map((d, i) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: DAY_COLORS[i % DAY_COLORS.length] }}
                />
                Dag {d.dayNumber}
              </span>
            ))}
          </div>
          <span className="rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[10px] text-muted-foreground border border-border">
            {trip.distanceKm} km · {trip.drivingTime}
          </span>
        </div>
      )}
    </div>
  );
}

// Re-export so callers can resolve a suggestion to a LatLng without an extra import.
export { lookupPlace };
