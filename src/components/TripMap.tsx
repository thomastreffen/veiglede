import { lazy, Suspense, useMemo, useState } from "react";
import type { Trip, TripDay, Stop } from "@/lib/trips-store";
import type { LatLng } from "@/lib/geo";
import { projectTrip, lookupPlace } from "@/lib/geo";
import { stopMeta } from "@/lib/trips-store";
import { useRuntimeMapConfig } from "@/lib/map/runtime-config";
import { cn } from "@/lib/utils";

// Lazy-load the real (MapLibre) renderer so the heavy dep is only paid
// for when MapTiler is actually configured.
type RealMapProps = Props & { maptilerKey: string; onError?: () => void };
const MapLibreTripMap = lazy(() =>
  import("./map/MapLibreTripMap")
    .then((m) => ({ default: m.MapLibreTripMap as (p: RealMapProps) => JSX.Element }))
    // If the chunk fails to load (e.g. network), fall back to SVG silently.
    .catch(() => ({ default: (props: RealMapProps) => <SvgTripMap {...props} /> })),
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
  // Compensate lng squeeze at higher latitudes (north Norway).
  const midLat = ((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180;
  const lngScale = Math.cos(midLat);
  const adjLngSpan = lngSpan * lngScale || 0.01;
  // Lock aspect to the larger span so the route doesn't squish.
  const scale = Math.min(innerW / adjLngSpan, innerH / latSpan);
  const centerX = width / 2;
  const centerY = height / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const x = centerX + (point.lng - centerLng) * lngScale * scale;
  // y inverted: north is up
  const y = centerY - (point.lat - centerLat) * scale;
  return { x, y };
}

// Day-segment colors (cycled).
const DAY_COLORS = [
  "oklch(0.78 0.17 65)",   // primary orange
  "oklch(0.75 0.16 200)",  // cyan
  "oklch(0.72 0.18 140)",  // green
  "oklch(0.70 0.20 320)",  // magenta
  "oklch(0.78 0.14 90)",   // yellow
];

/**
 * TripMap — provider-agnostic trip map.
 *
 * Renders a real tile-based map (MapLibre + MapTiler) when API keys are
 * configured, otherwise falls back to the SVG renderer. Consumers (planner,
 * roadbook, shared view) use this single component — they never reach for a
 * vendor SDK directly.
 */
export function TripMap(props: Props) {
  const [errored, setErrored] = useState(false);
  const cfg = useRuntimeMapConfig();
  if (cfg?.hasRealMap && cfg.maptilerKey && !errored) {
    return (
      <Suspense fallback={<SvgTripMap {...props} />}>
        <MapLibreTripMap {...props} maptilerKey={cfg.maptilerKey} onError={() => setErrored(true)} />
      </Suspense>
    );
  }
  return <SvgTripMap {...props} />;
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

  const W = 800;
  const H = 480;
  const padding = compact ? 32 : 48;

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
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-surface", height, className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
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
