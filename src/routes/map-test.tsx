import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export const Route = createFileRoute("/map-test")({
  component: MapTestPage,
});

interface Debug {
  keyLen: number;
  styleHost: string;
  mapCreated: boolean;
  styleLoaded: boolean;
  sourceCount: number;
  layerCount: number;
  canvasW: number;
  canvasH: number;
  lastError: string | null;
  center: [number, number] | null;
  zoom: number | null;
}

function MapTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [debug, setDebug] = useState<Debug>({
    keyLen: 0,
    styleHost: "",
    mapCreated: false,
    styleLoaded: false,
    sourceCount: 0,
    layerCount: 0,
    canvasW: 0,
    canvasH: 0,
    lastError: null,
    center: null,
    zoom: null,
  });

  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | null = null;

    (async () => {
      try {
        const res = await fetch("/api/public/map-config");
        const cfg = await res.json();
        const key: string = cfg.maptilerKey ?? "";
        if (!key) {
          setDebug((d) => ({ ...d, lastError: "no maptiler key" }));
          return;
        }
        const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`;
        const styleHost = new URL(styleUrl).host;

        if (cancelled || !containerRef.current) return;

        map = new maplibregl.Map({
          container: containerRef.current,
          style: styleUrl,
          center: [10.7522, 59.9139],
          zoom: 5,
        });
        mapRef.current = map;

        setDebug((d) => ({
          ...d,
          keyLen: key.length,
          styleHost,
          mapCreated: true,
        }));

        map.on("error", (e) => {
          setDebug((d) => ({ ...d, lastError: e.error?.message ?? "map error" }));
        });

        map.on("load", () => {
          if (!map) return;
          new maplibregl.Marker({ color: "#2563eb" })
            .setLngLat([10.7522, 59.9139])
            .addTo(map);

          map.addSource("test-route", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [10.2045, 59.7439], // Drammen
                  [7.155, 62.7372], // Molde
                ],
              },
            },
          });
          map.addLayer({
            id: "test-route-line",
            type: "line",
            source: "test-route",
            paint: {
              "line-color": "#f97316",
              "line-width": 5,
            },
          });

          map.resize();
          updateDebug();
        });

        const updateDebug = () => {
          if (!map) return;
          const canvas = map.getCanvas();
          const style = map.getStyle();
          const c = map.getCenter();
          setDebug((d) => ({
            ...d,
            styleLoaded: Boolean(map!.isStyleLoaded()),
            sourceCount: style?.sources ? Object.keys(style.sources).length : 0,
            layerCount: style?.layers?.length ?? 0,
            canvasW: canvas?.width ?? 0,
            canvasH: canvas?.height ?? 0,
            center: [c.lng, c.lat],
            zoom: map!.getZoom(),
          }));
        };

        map.on("idle", updateDebug);
        map.on("render", updateDebug);
      } catch (err) {
        setDebug((d) => ({
          ...d,
          lastError: err instanceof Error ? err.message : String(err),
        }));
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>MapLibre Test</h1>
      <div
        ref={containerRef}
        style={{ width: "100%", height: 500, background: "#222" }}
      />
      <pre
        style={{
          marginTop: 12,
          padding: 12,
          background: "#111",
          color: "#0f0",
          fontSize: 12,
          whiteSpace: "pre-wrap",
        }}
      >
{`keyLen:       ${debug.keyLen}
styleHost:    ${debug.styleHost}
mapCreated:   ${debug.mapCreated}
styleLoaded:  ${debug.styleLoaded}
sourceCount:  ${debug.sourceCount}
layerCount:   ${debug.layerCount}
canvas:       ${debug.canvasW}x${debug.canvasH}
center:       ${debug.center ? `${debug.center[0].toFixed(4)}, ${debug.center[1].toFixed(4)}` : "-"}
zoom:         ${debug.zoom?.toFixed(2) ?? "-"}
lastError:    ${debug.lastError ?? "-"}`}
      </pre>
    </div>
  );
}
