import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Monthly invoice generation — called by pg_cron on the 1st of each month
 * at 06:00 UTC. For every active campaign:
 *   1. Aggregate previous-month impressions / clicks
 *   2. Compute amount (CPM or fixed)
 *   3. Insert partner_invoices row
 *
 * Note: email delivery is wired separately. When the email domain is live,
 * we'll add the enqueue step here using the 'partner-invoice' template.
 */
export const Route = createFileRoute("/api/public/cron/generate-partner-invoices")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
        const periodStartStr = periodStart.toISOString().slice(0, 10);
        const periodEndStr = periodEnd.toISOString().slice(0, 10);

        const { data: campaigns } = await supabaseAdmin
          .from("partner_campaigns")
          .select("id, partner_account_id, partner_id, pricing_model, cpm_rate, budget_nok, status")
          .in("status", ["active", "completed"]);

        const summary = { created: 0, skipped: 0, failed: 0 };

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

          // Avoid duplicate invoice for the same campaign + period
          const { data: existing } = await supabaseAdmin
            .from("partner_invoices")
            .select("id")
            .eq("campaign_id", c.id)
            .eq("period_start", periodStartStr)
            .maybeSingle();
          if (existing) { summary.skipped++; continue; }

          const { error: invErr } = await supabaseAdmin
            .from("partner_invoices")
            .insert({
              partner_account_id: c.partner_account_id,
              campaign_id: c.id,
              period_start: periodStartStr,
              period_end: periodEndStr,
              impressions,
              clicks,
              amount_nok: amount,
              status: "unpaid",
            });
          if (invErr) {
            console.error("[invoices] insert failed", invErr);
            summary.failed++;
            continue;
          }
          summary.created++;
        }

        return Response.json({ ok: true, ...summary });
      },
    },
  },
});
