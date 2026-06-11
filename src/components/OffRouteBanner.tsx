// Active-trip off-route helper: detects when the driver's live position drifts
// away from the planned polyline and offers a manual "recompute from here"
// action. Intentionally minimal — we never reorder stops or rewrite the
// roadbook, we only redraw the displayed route.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { distanceToRoute } from "@/lib/geo";
import { getRoute } from "@/lib/routing";
import { tripsApi, type Trip, type Stop } from "@/lib/trips-store";

interface Props {
  trip: Trip;
  stops: Stop[];
  livePos: { lat: number; lng: number } | null;
}

// Distance considered "off-route" (km) — must persist for OFF_ROUTE_MS.
const OFF_ROUTE_KM = 0.2;
const OFF_ROUTE_MS = 25_000;
// Throttle reroute attempts.
const REROUTE_COOLDOWN_MS = 90_000;

function formatDrivingTime(min: number): string {
  if (!min || min < 1) return "0min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

export function OffRouteBanner({ trip, stops, livePos }: Props) {
  const geometry = trip.routeGeometry ?? [];
  const offSinceRef = useRef<number | null>(null);
  const lastRerouteAtRef = useRef<number>(0);
  const [offRoute, setOffRoute] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    if (!livePos || geometry.length < 2) {
      offSinceRef.current = null;
      setOffRoute(false);
      return;
    }
    const d = distanceToRoute(livePos, geometry);
    if (d > OFF_ROUTE_KM) {
      if (offSinceRef.current === null) offSinceRef.current = Date.now();
      if (Date.now() - offSinceRef.current >= OFF_ROUTE_MS) setOffRoute(true);
    } else {
      offSinceRef.current = null;
      setOffRoute(false);
    }
  }, [livePos, geometry]);

  if (!livePos || geometry.length < 2 || !offRoute) return null;

  const handleReroute = async () => {
    if (Date.now() - lastRerouteAtRef.current < REROUTE_COOLDOWN_MS) {
      toast.info("Vent litt før du oppdaterer ruten igjen.");
      return;
    }
    // Destination = trip.destinationLoc or last stop with coords. Preserve any
    // remaining stops between live position and destination as waypoints.
    const destLoc = trip.destinationLoc;
    if (!destLoc || !Number.isFinite(destLoc.lat) || !Number.isFinite(destLoc.lng)) {
      toast.error("Destinasjonen mangler koordinater — kan ikke beregne rute fra posisjonen din.");
      return;
    }
    const remainingStops = stops
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));

    setBusy(true);
    try {
      const route = await getRoute({
        origin: { lat: livePos.lat, lng: livePos.lng },
        destination: destLoc,
        waypoints: remainingStops,
        routeStyle: trip.style === "fastest" ? "fastest" : "scenic",
      });
      if (!route || !route.geometry?.length) {
        toast.error("Kunne ikke beregne ny rute akkurat nå.");
        return;
      }
      tripsApi.updateTrip(trip.id, {
        routeGeometry: route.geometry,
        routeDistanceKm: route.distanceKm,
        routeDurationMin: route.durationMin,
        routeProvider: route.provider,
        distanceKm: Math.round(route.distanceKm),
        drivingTime: formatDrivingTime(route.durationMin),
      });
      lastRerouteAtRef.current = Date.now();
      setOffRoute(false);
      offSinceRef.current = null;
      setCooldown(true);
      setTimeout(() => setCooldown(false), REROUTE_COOLDOWN_MS);
      toast.success("Ruten er oppdatert fra din posisjon.");
    } catch (e) {
      console.warn("[off-route] reroute failed", e);
      toast.error("Kunne ikke beregne ny rute akkurat nå.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
      <span className="flex-1 min-w-0">
        Du er utenfor planlagt rute. Vil du oppdatere ruten fra din posisjon?
      </span>
      <button
        type="button"
        onClick={handleReroute}
        disabled={busy || cooldown}
        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-amber-950 hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
        Oppdater rute fra min posisjon
      </button>
    </div>
  );
}
