import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMaptilerStyleUrl } from "@/lib/map/runtime-config";

interface Props {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
}

/** Tiny non-interactive MapLibre preview centered on a single point. */
export function MapPreview({ lat, lng, zoom = 12, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: buildMaptilerStyleUrl(),
      center: [lng, lat],
      zoom,
      attributionControl: false,
      interactive: false,
    });
    mapRef.current = map;
    markerRef.current = new maplibregl.Marker({ color: "#ff6b35" }).setLngLat([lng, lat]).addTo(map);
    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setCenter([lng, lat]);
    markerRef.current?.setLngLat([lng, lat]);
  }, [lat, lng]);

  return <div ref={ref} className={className ?? "h-40 w-full rounded-lg overflow-hidden border border-slate-700"} />;
}
