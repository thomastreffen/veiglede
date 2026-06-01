import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Stripe webhook (proxied through Lovable Payments).
 * URL is registered as: /api/public/payments/webhook?env=sandbox|live
 *
 * Lovable's payments gateway forwards Stripe events as a normalized payload.
 * We treat completion events for Checkout Sessions / PaymentIntents that
 * carry our `invoiceId` in metadata, and mark the invoice as paid.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw = "";
        try {
          raw = await request.text();
        } catch {
          return new Response("bad body", { status: 400 });
        }

        let payload: any = null;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const evtType: string = String(payload?.type ?? "");
        const obj = payload?.data?.object ?? payload?.data ?? payload;

        // We care about completed payments.
        const isCompletion =
          evtType === "transaction.completed" ||
          evtType === "checkout.session.completed" ||
          evtType === "payment_intent.succeeded";

        if (!isCompletion) {
          return new Response(JSON.stringify({ ok: true, ignored: evtType }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const invoiceId: string | undefined =
          obj?.metadata?.invoiceId ??
          obj?.metadata?.invoice_id ??
          payload?.metadata?.invoiceId;

        const sessionId: string | undefined = obj?.id ?? payload?.id;
        const receiptUrl: string | undefined =
          obj?.charges?.data?.[0]?.receipt_url ??
          obj?.receipt_url ??
          obj?.invoice_pdf;

        if (!invoiceId && !sessionId) {
          console.warn("[stripe-webhook] no invoiceId/sessionId in payload");
          return new Response(JSON.stringify({ ok: true, skipped: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return new Response("server misconfigured", { status: 500 });
        }
        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const update: Record<string, unknown> = {
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_method: "stripe",
        };
        if (receiptUrl) update.stripe_receipt_url = receiptUrl;
        if (sessionId) update.stripe_session_id = sessionId;

        const query = supabase.from("partner_invoices").update(update);
        const { error } = invoiceId
          ? await query.eq("id", invoiceId)
          : await query.eq("stripe_session_id", sessionId!);

        if (error) {
          console.error("[stripe-webhook] update failed", error);
          return new Response("db error", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
