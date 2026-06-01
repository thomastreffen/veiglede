import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Monthly invoice generation — called by pg_cron on the 1st of each month.
 * For every active campaign, aggregates the previous month's impressions/clicks
 * (currently sourced from the partners row's monthly counters, since per-day
 * partner stats aren't tracked yet) and inserts an unpaid invoice row.
 */
export const Route = createFileRoute("/api/public/cron/generate-partner-invoices")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        // Period = previous month
        const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day prev month
        const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

        const { data: campaigns } = await supabaseAdmin
          .from("partner_campaigns")
          .select("id, partner_account_id, partner_id, pricing_model, cpm_rate, budget_nok, status")
          .in("status", ["active", "completed"]);

        let created = 0;
        for (const c of campaigns ?? []) {
          let impressions = 0;
          let clicks = 0;
          if (c.partner_id) {
            const { data: p } = await supabaseAdmin
              .from("partners")
              .select("impressions_this_month, clicks_this_month")
              .eq("id", c.partner_id)
              .maybeSingle();
            impressions = p?.impressions_this_month ?? 0;
            clicks = p?.clicks_this_month ?? 0;
          }

          const amount =
            c.pricing_model === "cpm"
              ? Math.round((impressions / 1000) * c.cpm_rate)
              : c.budget_nok;

          await supabaseAdmin.from("partner_invoices").insert({
            partner_account_id: c.partner_account_id,
            campaign_id: c.id,
            period_start: periodStart.toISOString().slice(0, 10),
            period_end: periodEnd.toISOString().slice(0, 10),
            impressions,
            clicks,
            amount_nok: amount,
            status: "unpaid",
          });
          created++;
        }

        return new Response(JSON.stringify({ ok: true, created }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
