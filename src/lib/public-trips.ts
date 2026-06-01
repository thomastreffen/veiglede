/**
 * Public re-exports for trip discovery. Keeps imports stable for the
 * /explore page while the server-fn implementation lives in
 * public-trips.functions.ts.
 */
export {
  fetchPublicTripsFn as fetchPublicTrips,
  getPublicTripByToken,
  type PublicTripSummary,
  type PublicTripPayload,
} from "@/lib/public-trips.functions";
