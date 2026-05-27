// No-op providers used when no API keys are configured.
// Keeps call sites uniform: they always get an object back and check `.available`.

import type { GeocodingService, PlacesService, RoutingService } from "../types";

export const noopRouting: RoutingService = {
  id: "noop",
  available: false,
  async route() { return null; },
};

export const noopGeocoding: GeocodingService = {
  id: "noop",
  available: false,
  async geocode() { return null; },
};

export const noopPlaces: PlacesService = {
  id: "noop",
  available: false,
};
