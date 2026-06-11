import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMaptilerStyleUrl, useRuntimeMapConfig } from "@/lib/map/runtime-config";

export interface RoutePoint {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  points: RoutePoint[];
  className?: string;
  interactive?: boolean;
}

/**
 * Lightweight non-routing map preview for curated/inspiration trips.
 *
 * Draws markers for every stop (start = orange, end = green, middle = grey)
 * plus a dashed line between them as a "schematic" of the route. The exact
 * road geometry will be computed when the user copies the trip and edits it.
 */
export function CuratedRoutePreview({ points, className, interactive = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cfg = useRuntimeMapConfig();

  useEffect(() => {
    if (!ref.current || !cfg?.maptilerKey || points.length === 0) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: buildMaptilerStyleUrl(cfg.maptilerKey),
      center: [points[0].lng, points[0].lat],
      zoom: 6,
      attributionControl: false,
      interactive,
    });
    const markers: maplibregl.Marker[] = [];
    map.on("load", () => {
      points.forEach((p, i) => {
        const isStart = i === 0;
        const isEnd = i === points.length - 1 && points.length > 1;
        const color = isStart ? "#ff6b35" : isEnd ? "#10b981" : "#94a3b8";
        const m = new maplibregl.Marker({ color }).setLngLat([p.lng, p.lat]);
        if (p.label) m.setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setText(p.label));
        m.addTo(map);
        markers.push(m);
      });
      if (points.length > 1) {
        map.addSource("line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
          },
        });
        map.addLayer({
          id: "line",
          type: "line",
          source: "line",
          paint: { "line-color": "#ff6b35", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": 0.85 },
        });
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 50, duration: 0, maxZoom: 9 });
      }
    });
    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.maptilerKey, JSON.stringify(points), interactive]);

  if (!cfg?.maptilerKey) {
    return (
      <div className={className ?? "h-60 w-full rounded-2xl border border-border bg-surface grid place-items-center text-xs text-muted-foreground"}>
        Kartforhåndsvisning utilgjengelig
      </div>
    );
  }
  return <div ref={ref} className={className ?? "h-60 w-full rounded-2xl overflow-hidden border border-border"} />;
}
