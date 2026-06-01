import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { render as renderAsync } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "veiglede";
const SENDER_DOMAIN = "notify.veiglede.no";
const FROM_DOMAIN = "veiglede.no";

function formatPeriod(start: string, end: string): string {
  const months = [
    "januar","februar","mars","april","mai","juni",
    "juli","august","september","oktober","november","desember",
  ];
  const d = new Date(start);
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Monthly invoice generation — called by pg_cron on the 1st of each month
 * at 06:00 UTC. For every active campaign:
 *   1. Aggregate previous-month impressions / clicks
 *   2. Compute amount (CPM or fixed)
 *   3. Insert partner_invoices row
 *   4. Enqueue invoice email to the partner
 */
export const Route = createFileRoute("/api/public/cron/generate-partner-invoices")({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "server_misconfigured" }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const now = new Date();
        const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
        const periodStartStr = periodStart.toISOString().slice(0, 10);
        const periodEndStr = periodEnd.toISOString().slice(0, 10);
        const periodLabel = formatPeriod(periodStartStr, periodEndStr);

        const { data: campaigns } = await supabase
          .from("partner_campaigns")
          .select("id, partner_account_id, partner_id, pricing_model, cpm_rate, budget_nok, status")
          .in("status", ["active", "completed"]);

        const template = TEMPLATES["partner-invoice"];
        const bankAccount = process.env.BANK_ACCOUNT ?? null;
        const summary = { created: 0, emailed: 0, skipped: 0, failed: 0 };

        for (const c of campaigns ?? []) {
          let impressions = 0;
          let clicks = 0;
          if (c.partner_id) {
            const { data: p } = await supabase
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
          const { data: existing } = await supabase
            .from("partner_invoices")
            .select("id")
            .eq("campaign_id", c.id)
            .eq("period_start", periodStartStr)
            .maybeSingle();
          if (existing) { summary.skipped++; continue; }

          const { data: invoice, error: invErr } = await supabase
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
            })
            .select("id")
            .single();
          if (invErr || !invoice) {
            console.error("[invoices] insert failed", invErr);
            summary.failed++;
            continue;
          }
          summary.created++;

          // ---- Email the partner ----
          if (!template || amount <= 0) continue;

          const { data: account } = await supabase
            .from("partner_accounts")
            .select("user_id, business_name")
            .eq("id", c.partner_account_id)
            .maybeSingle();
          if (!account) continue;

          const { data: userRes } = await supabase.auth.admin.getUserById(account.user_id);
          const recipient = userRes?.user?.email;
          if (!recipient) continue;

          const normalized = recipient.toLowerCase();
          const { data: suppressed } = await supabase
            .from("suppressed_emails").select("id").eq("email", normalized).maybeSingle();
          if (suppressed) continue;

          // Unsubscribe token (transactional emails still respect it)
          let unsubscribeToken = generateToken();
          const { data: existingTok } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token, used_at").eq("email", normalized).maybeSingle();
          if (existingTok && !existingTok.used_at) {
            unsubscribeToken = existingTok.token;
          } else {
            await supabase.from("email_unsubscribe_tokens").upsert(
              { token: unsubscribeToken, email: normalized },
              { onConflict: "email", ignoreDuplicates: true },
            );
            const { data: stored } = await supabase
              .from("email_unsubscribe_tokens").select("token").eq("email", normalized).maybeSingle();
            if (stored?.token) unsubscribeToken = stored.token;
          }

          const templateData = {
            businessName: account.business_name,
            periodLabel,
            impressions,
            clicks,
            amountNok: amount,
            payUrl: `https://veiglede.no/partner/dashboard/invoices`,
            bankAccount,
            invoiceRef: invoice.id.slice(0, 8).toUpperCase(),
          };
          const element = React.createElement(template.component, templateData);
          const html = await renderAsync(element);
          const plainText = await renderAsync(element, { plainText: true });
          const subject =
            typeof template.subject === "function"
              ? template.subject(templateData)
              : template.subject;

          const messageId = crypto.randomUUID();
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: "partner-invoice",
            recipient_email: recipient,
            status: "pending",
          });

          const { error: enqErr } = await supabase.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              message_id: messageId,
              to: recipient,
              from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
              sender_domain: SENDER_DOMAIN,
              subject,
              html,
              text: plainText,
              purpose: "transactional",
              label: "partner-invoice",
              idempotency_key: `partner-invoice:${invoice.id}`,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          });
          if (enqErr) {
            console.error("[invoices] enqueue failed", enqErr);
            summary.failed++;
            continue;
          }
          await supabase
            .from("partner_invoices")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", invoice.id);
          summary.emailed++;
        }

        return Response.json({ ok: true, ...summary });
      },
    },
  },
});
