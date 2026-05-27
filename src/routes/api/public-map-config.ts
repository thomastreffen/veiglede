// Runtime map config endpoint.
//
// Returns ONLY the MapTiler browser key (which is safe to expose because
// MapTiler frontend keys are restricted by allowed HTTP origins in the
// MapTiler dashboard). No other env vars are returned.
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json",
} as const;

export const Route = createFileRoute("/api/public-map-config")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () => {
        const key = (process.env.MAPTILER_API_KEY ?? "").trim() || null;
        return new Response(
          JSON.stringify({ maptilerKey: key, hasRealMap: Boolean(key) }),
          { status: 200, headers: CORS_HEADERS },
        );
      },
    },
  },
});
