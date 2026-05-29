// Shared MapTiler geocoding parameters.
// Import this in every autocomplete input so Norwegian proximity bias
// stays consistent across the app.

export const MAPTILER_GEOCODING_PARAMS = {
  proximity: "9.0,61.0",
  language: "no",
  country: "no,se,dk,de",
  limit: 5,
} as const;
