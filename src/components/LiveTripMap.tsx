// Lightweight MapLibre map showing a single animated driver marker.
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLiveSession, isLiveActive, type LiveSession } from "@/lib/live-tracking";
import { createLiveMarkerEl } from "@/lib/live-marker";

interface Props {
  tripId?: string;
  /** Pre-fetched session (e.g. from useLiveSessionByToken in a public route). */
  session?: LiveSession | null;
  /** Vehicle type for the live marker icon. Falls back to default dot. */
  vehicle?: string | null;
  height?: string;
  className?: string;
}


type Phase = "waiting" | "active" | "paused" | "ended";

function getPhase(session: LiveSession | null | undefined): Phase {
  if (!session) return "waiting";
  if (session.status === "completed") return "ended";
  const age = Date.now() - new Date(session.updated_at).getTime();
  if (age >= 5 * 60 * 1000) return "ended";
  if (session.status === "paused") return "paused";
  return "active";
}

function formatRelative(iso: string | undefined | null): string {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 10) return "nå nettopp";
  if (s < 60) return `${s} sek siden`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  return `${h} t siden`;
}

export function LiveTripMap({ tripId, session: sessionProp, height, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const [mapKey, setMapKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  // Always call the hook; pass null when caller supplies the session directly.
  const hookSession = useLiveSession(sessionProp === undefined ? tripId ?? null : null);
  const session = sessionProp !== undefined ? sessionProp : hookSession;
  const phase = getPhase(session);
  const live = isLiveActive(session);

  // Re-render every 30s so "Sist oppdatert" stays fresh even without payload changes.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

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
      zoom: session ? 12 : 5,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    // iOS Safari sometimes mounts the canvas before the container's height
    // is final — resize twice to be safe.
    const raf = requestAnimationFrame(() => { try { map.resize(); } catch {} });
    const t1 = setTimeout(() => { try { map.resize(); } catch {} }, 100);
    const t2 = setTimeout(() => { try { map.resize(); } catch {} }, 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      markerElRef.current = null;
    };
  }, [mapKey, session]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !session) return;
    const lngLat: [number, number] = [session.lng, session.lat];
    const ended = phase === "ended";
    const paused = phase === "paused";

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "vg-live-marker";
      el.innerHTML = `
        <div class="vg-live-marker__pulse"></div>
        <div class="vg-live-marker__dot">
          <div class="vg-live-marker__arrow"></div>
        </div>
      `;
      markerElRef.current = el;
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(lngLat)
        .addTo(map);
      map.flyTo({ center: lngLat, zoom: 13, duration: 800 });
    } else {
      markerRef.current.setLngLat(lngLat);
      map.easeTo({ center: lngLat, duration: 600 });
    }

    const el = markerElRef.current;
    if (el) {
      el.classList.toggle("vg-live-marker--paused", paused);
      el.classList.toggle("vg-live-marker--ended", ended);
      const arrow = el.querySelector<HTMLElement>(".vg-live-marker__arrow");
      if (arrow) {
        if (typeof session.heading === "number" && !Number.isNaN(session.heading)) {
          arrow.style.transform = `rotate(${session.heading}deg)`;
          arrow.style.opacity = "1";
        } else {
          arrow.style.opacity = "0";
        }
      }
    }
  }, [session, phase]);

  const speedKmh =
    session && typeof session.speed === "number" && session.speed > 0.5
      ? Math.round(session.speed * 3.6)
      : null;

  const statusLabel =
    phase === "active" ? "Live" :
    phase === "paused" ? "Pauset" :
    phase === "ended" ? "Avsluttet" :
    "Venter";

  const statusDotClass =
    phase === "active" ? "bg-primary animate-pulse" :
    phase === "paused" ? "bg-yellow-500" :
    phase === "ended" ? "bg-muted-foreground" :
    "bg-muted-foreground animate-pulse";

  const bottomMessage =
    !session ? "Venter på første posisjon…" :
    phase === "paused" ? "Live deling er pauset" :
    phase === "ended" ? "Live deling er avsluttet" :
    null;

  return (
    <div className={className}>
      <style>{`
        .vg-live-marker { position: relative; width: 44px; height: 44px; }
        .vg-live-marker__dot {
          position: absolute; inset: 10px;
          background: oklch(0.72 0.18 55); border: 3px solid #fff;
          border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.45);
          display: grid; place-items: center;
        }
        .vg-live-marker__arrow {
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 10px solid #fff;
          transform-origin: 50% 70%;
          margin-top: -2px;
          opacity: 0;
          transition: transform 400ms ease;
        }
        .vg-live-marker__pulse {
          position: absolute; inset: 0; border-radius: 9999px;
          background: oklch(0.72 0.18 55 / 0.5);
          animation: vg-live-pulse 1.6s ease-out infinite;
        }
        .vg-live-marker--paused .vg-live-marker__dot { background: #eab308; }
        .vg-live-marker--paused .vg-live-marker__pulse { animation: none; background: rgba(234,179,8,0.35); }
        .vg-live-marker--ended .vg-live-marker__dot { background: #6b7280; }
        .vg-live-marker--ended .vg-live-marker__pulse { display: none; }
        @keyframes vg-live-pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <div
        className="relative rounded-2xl overflow-hidden border border-border bg-surface w-full min-h-[420px] h-[420px]"
        style={{ height: height || "420px", minHeight: height || "420px" }}
      >
        <div ref={containerRef} className="absolute inset-0 h-full w-full" style={{ height: "100%", width: "100%" }} />
        {keyError && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{keyError}</div>
        )}
        <div className="absolute left-3 top-3 right-3 flex justify-between gap-2 pointer-events-none">
          <div className="inline-flex items-center gap-2 rounded-full bg-background/90 backdrop-blur border border-border px-3 py-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            <span className="font-semibold uppercase tracking-wider">{statusLabel}</span>
            {speedKmh !== null && live && (
              <span className="text-muted-foreground">· {speedKmh} km/t</span>
            )}
          </div>
          {session?.last_stop_name && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border border-border px-3 py-1.5 text-xs max-w-[60%] truncate">
              Sist: {session.last_stop_name}
            </div>
          )}
        </div>
        {session && (
          <div className="absolute right-3 bottom-3 rounded-full bg-background/90 backdrop-blur border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            Sist oppdatert {formatRelative(session.updated_at)}
          </div>
        )}
        {bottomMessage && (
          <div className="absolute bottom-3 left-3 max-w-[60%] rounded-xl border border-border bg-background/90 backdrop-blur p-3 text-xs text-foreground">
            {bottomMessage}
          </div>
        )}
      </div>
    </div>
  );
}
