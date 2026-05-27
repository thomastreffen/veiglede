// Runtime map config loader.
//
// Fetches `/api/public-map-config` once per session, caches the promise,
// and exposes a small hook + helper so TripMap can decide whether to
// render the real MapLibre map or fall back to SVG.

import { useEffect, useState } from "react";

export interface RuntimeMapConfig {
  maptilerKey: string | null;
  hasRealMap: boolean;
}

const FALLBACK: RuntimeMapConfig = { maptilerKey: null, hasRealMap: false };

let cached: Promise<RuntimeMapConfig> | null = null;
let resolved: RuntimeMapConfig | null = null;

export function getRuntimeMapConfig(): Promise<RuntimeMapConfig> {
  if (cached) return cached;
  if (typeof fetch === "undefined") return Promise.resolve(FALLBACK);
  cached = fetch("/api/public/map-config", { headers: { Accept: "application/json" } })
    .then(async (r) => {
      if (!r.ok) return FALLBACK;
      const data = (await r.json()) as Partial<RuntimeMapConfig>;
      const out: RuntimeMapConfig = {
        maptilerKey: typeof data.maptilerKey === "string" && data.maptilerKey.length > 0 ? data.maptilerKey : null,
        hasRealMap: Boolean(data.hasRealMap && data.maptilerKey),
      };
      resolved = out;
      return out;
    })
    .catch(() => FALLBACK);
  return cached;
}

export function getResolvedMapConfig(): RuntimeMapConfig | null {
  return resolved;
}

export function buildMaptilerStyleUrl(key: string, variant: "dark" | "light" = "dark"): string {
  const style = variant === "light" ? "streets-v2" : "streets-v2-dark";
  return `https://api.maptiler.com/maps/${style}/style.json?key=${encodeURIComponent(key)}`;
}

/** React hook — returns null while loading, then the resolved config. */
export function useRuntimeMapConfig(): RuntimeMapConfig | null {
  const [cfg, setCfg] = useState<RuntimeMapConfig | null>(resolved);
  useEffect(() => {
    if (resolved) { setCfg(resolved); return; }
    let cancelled = false;
    getRuntimeMapConfig().then((c) => { if (!cancelled) setCfg(c); });
    return () => { cancelled = true; };
  }, []);
  return cfg;
}
