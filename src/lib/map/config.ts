// Provider-agnostic map configuration.
//
// MapTiler key is loaded at RUNTIME via /api/public-map-config (see
// src/lib/map/runtime-config.ts) so it doesn't require a build-time
// VITE_* env var. ORS (routing/geocoding) is still build-time since
// it's optional and primarily used server-side / dev-side.

const ORS_KEY = (import.meta.env.VITE_OPENROUTESERVICE_API_KEY ?? "").trim();

export const mapConfig = {
  openrouteserviceKey: ORS_KEY || null,
  /** Routing / geocoding is available. */
  get hasRouting() { return Boolean(this.openrouteserviceKey); },
  get hasGeocoding() { return Boolean(this.openrouteserviceKey); },
};

export type MapStyleVariant = "dark" | "light";
