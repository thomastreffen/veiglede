// Lightweight MapLibre map showing a single animated driver marker.
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLiveSession, isLiveActive, type LiveSession } from "@/lib/live-tracking";

interface Props {
  tripId?: string;
  /** Pre-fetched session (e.g. from useLiveSessionByToken in a public route). */
  session?: LiveSession | null;
  height?: string;
  className?: string;
}

export function LiveTripMap({ tripId, session: sessionProp, height = "60vh", className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapKey, setMapKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  // Always call the hook; pass null when caller supplies the session directly.
  const hookSession = useLiveSession(sessionProp === undefined ? tripId ?? null : null);
  const session = sessionProp !== undefined ? sessionProp : hookSession;
  const live = isLiveActive(session);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/map-config")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.maptilerKey) setMapKey(d.maptilerKey);
        else setKeyError("Mangler kartnøkkel");
      })
      .catch(() => { if (!cancelled) setKeyError("Klarte ikke laste kart"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapKey || !containerRef.current || mapRef.current) return;
    const initial = session ? [session.lng, session.lat] as [number, number] : [10.75, 60.0] as [number, number];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapKey}`,
      center: initial,
      zoom: session ? 11 : 5,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mapKey, session]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !session) return;
    const lngLat: [number, number] = [session.lng, session.lat];

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "vg-live-marker";
      el.innerHTML = `
        <div class="vg-live-marker__pulse"></div>
        <div class="vg-live-marker__dot"></div>
      `;
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(lngLat)
        .addTo(map);
      map.flyTo({ center: lngLat, zoom: 12, duration: 800 });
    } else {
      markerRef.current.setLngLat(lngLat);
      map.easeTo({ center: lngLat, duration: 600 });
    }
  }, [session]);

  return (
    <div className={className}>
      <style>{`
        .vg-live-marker { position: relative; width: 28px; height: 28px; }
        .vg-live-marker__dot {
          position: absolute; inset: 6px;
          background: oklch(0.72 0.18 55); border: 2px solid #fff;
          border-radius: 9999px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .vg-live-marker__pulse {
          position: absolute; inset: 0; border-radius: 9999px;
          background: oklch(0.72 0.18 55 / 0.5);
          animation: vg-live-pulse 1.6s ease-out infinite;
        }
        @keyframes vg-live-pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface" style={{ height }}>
        <div ref={containerRef} className="absolute inset-0" />
        {keyError && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{keyError}</div>
        )}
        <div className="absolute left-3 top-3 right-3 flex justify-between gap-2 pointer-events-none">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/85 backdrop-blur border border-border px-3 py-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
            <span className="font-semibold uppercase tracking-wider">
              {live ? (session?.status === "paused" ? "Pause" : "Live") : "Ingen live-data"}
            </span>
          </div>
          {session?.last_stop_name && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur border border-border px-3 py-1.5 text-xs max-w-[60%] truncate">
              Sist: {session.last_stop_name}
            </div>
          )}
        </div>
        {!session && !keyError && (
          <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border bg-background/85 backdrop-blur p-3 text-xs text-muted-foreground">
            Føreren har ikke begynt å dele posisjon enda. Kartet oppdateres automatisk når delingen starter.
          </div>
        )}
      </div>
    </div>
  );
}
