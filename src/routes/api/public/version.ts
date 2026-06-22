import { createFileRoute } from "@tanstack/react-router";

// Module-scope constant — evaluated once per worker boot, i.e. per deployment.
// Each new deploy spins up a fresh worker, giving us a unique buildId.
const BUILD_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(JSON.stringify({ buildId: BUILD_ID }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            // Never cache — clients poll this to detect deploys.
            "cache-control": "no-store, max-age=0, must-revalidate",
            "pragma": "no-cache",
          },
        });
      },
    },
  },
});
