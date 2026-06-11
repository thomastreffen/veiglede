import { type ReactNode } from "react";
import { CuratedRoutePreview, type RoutePoint } from "@/components/CuratedRoutePreview";
import { Map as MapIcon } from "lucide-react";

interface Props {
  /** The left-side planning form (the existing wizard UI). */
  children: ReactNode;
  /** Ordered points: origin → via stops → destination. */
  points: RoutePoint[];
  /** Optional summary shown above the map. */
  summary?: ReactNode;
}

/**
 * Desktop-first split layout for trip planning.
 *
 * - On `lg` and up: left sidebar with the planning form, large map workspace
 *   filling the rest of the screen — sofa-planning workspace.
 * - Below `lg`: renders children as-is so the existing mobile step-based
 *   wizard remains card-first and untouched.
 */
export function PlannerWorkspace({ children, points, summary }: Props) {
  return (
    <>
      {/* Mobile / tablet: unchanged card-based wizard */}
      <div className="lg:hidden">{children}</div>

      {/* Desktop: map-first workspace */}
      <div className="hidden lg:grid lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[460px_minmax(0,1fr)] gap-0 h-[calc(100vh-4rem)] -mx-4 md:-mx-8">
        {/* Left planning rail */}
        <aside className="border-r border-border bg-surface overflow-y-auto">
          <div className="p-5 xl:p-6">{children}</div>
        </aside>

        {/* Right map workspace */}
        <section className="relative bg-surface-2 overflow-hidden">
          {points.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-center p-10">
              <div className="max-w-sm">
                <div className="mx-auto h-16 w-16 rounded-2xl border-2 border-dashed border-border bg-surface grid place-items-center">
                  <MapIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="mt-6 font-display text-2xl uppercase">Planlegg på stort kart</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Velg avreisested og destinasjon i panelet til venstre — ruten dukker opp her med en gang vi har koordinater.
                </p>
              </div>
            </div>
          ) : (
            <>
              <CuratedRoutePreview
                points={points}
                interactive
                className="absolute inset-0 h-full w-full"
              />
              {summary && (
                <div className="pointer-events-none absolute top-4 left-4 right-4 flex justify-center">
                  <div className="pointer-events-auto rounded-2xl border border-border bg-background/90 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-wider shadow-lg">
                    {summary}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
