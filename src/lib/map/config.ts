// Provider-agnostic map configuration.
// Reads Vite env vars and exposes capability flags so the rest of the app
// (and the TripMap component) can switch between the real map renderer and
// the SVG fallback without being coupled to any specific vendor.

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_API_KEY ?? "").trim();
const ORS_KEY = (import.meta.env.VITE_OPENROUTESERVICE_API_KEY ?? "").trim();

export const mapConfig = {
  maptilerKey: MAPTILER_KEY || null,
  openrouteserviceKey: ORS_KEY || null,
  /** Real (tile-based) map renderer is available. */
  get hasTiles() { return Boolean(this.maptilerKey); },
  /** Routing / geocoding is available. */
  get hasRouting() { return Boolean(this.openrouteserviceKey); },
  get hasGeocoding() { return Boolean(this.openrouteserviceKey); },
  /** TripMap should render a real map (vs. SVG fallback). */
  get hasRealMap() { return Boolean(this.maptilerKey); },
};

export type MapStyleVariant = "dark" | "light";

export function getMaptilerStyleUrl(variant: MapStyleVariant = "dark"): string | null {
  if (!mapConfig.maptilerKey) return null;
  const style = variant === "light" ? "streets-v2" : "streets-v2-dark";
  return `https://api.maptiler.com/maps/${style}/style.json?key=${mapConfig.maptilerKey}`;
}
