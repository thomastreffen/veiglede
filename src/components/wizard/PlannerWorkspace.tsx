import { type ReactNode } from "react";
import { CuratedRoutePreview, type RoutePoint } from "@/components/CuratedRoutePreview";

interface Props {
  /** The left-side planning form (the existing wizard UI). */
  children: ReactNode;
  /** Ordered points: origin → via stops → destination. */
  points: RoutePoint[];
  /** Optional summary shown above the map. */
  summary?: ReactNode;
  /** Real road geometry — when provided the map draws the actual route line. */
  routeGeometry?: { lat: number; lng: number }[];

}

/** Default view: Norway, roughly centered, fits whole country. */
const DEFAULT_NORWAY_POINTS: RoutePoint[] = [
  { lat: 58.0, lng: 5.5 },   // SW corner
  { lat: 71.1, lng: 28.5 },  // NE corner (Nordkapp area)
];

/**
 * Desktop-first split layout for trip planning. The map is always rendered
 * and interactive; instructional copy appears as an overlay, never as a
 * replacement for the map.
 */
export function PlannerWorkspace({ children, points, summary }: Props) {
  const hasPoints = points.length > 0;
  const mapPoints = hasPoints ? points : DEFAULT_NORWAY_POINTS;

  return (
    <>
      {/* Mobile / tablet: unchanged card-based wizard */}
      <div className="lg:hidden">{children}</div>

      {/* Desktop: map-first workspace */}
      <div className="hidden lg:block relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
        <div className="grid lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)] gap-0 h-[calc(100vh-4rem)]">
        {/* Left planning rail */}
        <aside className="border-r border-border bg-surface overflow-y-auto">
          <div className="p-5 xl:p-6">{children}</div>
        </aside>

        {/* Right map workspace — always interactive */}
        <section className="relative bg-surface-2 overflow-hidden">
          <CuratedRoutePreview
            points={mapPoints}
            interactive
            showMarkers={hasPoints}
            className="absolute inset-0 h-full w-full"
          />

          {summary && (
            <div className="pointer-events-none absolute top-4 left-4 right-4 flex justify-center">
              <div className="pointer-events-auto rounded-2xl border border-border bg-background/90 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-wider shadow-lg">
                {summary}
              </div>
            </div>
          )}

          {!hasPoints && (
            <div className="pointer-events-none absolute bottom-6 left-6 right-6 flex justify-center">
              <div className="pointer-events-auto max-w-md rounded-2xl border border-border bg-background/90 backdrop-blur px-5 py-3 text-center shadow-lg">
                <p className="text-sm text-foreground">
                  Velg avreisested og destinasjon i panelet til venstre — markører og rute dukker opp på kartet med en gang.
                </p>
              </div>
            </div>
          )}
        </section>
        </div>
      </div>
    </>
  );
}
