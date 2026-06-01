import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron hook: resets partners.impressions_this_month and
 * partners.clicks_this_month to zero. Invoked by pg_cron on the 1st of
 * each month at 00:05 UTC. Uses the anon key in the `apikey` header to
 * confirm the call came from inside the project, then performs the
 * write with a service-role client created from the request token.
 */
export const Route = createFileRoute("/api/public/hooks/partners-monthly-reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );
        const { error } = await supabase.rpc("reset_partner_monthly_stats");
        if (error) {
          console.error("Partner monthly reset failed:", error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ success: true, resetAt: new Date().toISOString() }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
