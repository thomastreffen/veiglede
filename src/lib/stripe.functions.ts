import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STRIPE_GATEWAY = "https://connector-gateway.lovable.dev/stripe";
const SITE_URL = "https://veiglede.no";

function getStripeKey(): { key: string; env: "live" | "sandbox" } {
  const live = process.env.STRIPE_LIVE_API_KEY;
  if (live) return { key: live, env: "live" };
  const sandbox = process.env.STRIPE_SANDBOX_API_KEY;
  if (sandbox) return { key: sandbox, env: "sandbox" };
  throw new Error("Stripe-nøkkel mangler");
}

function getLovableKey(): string {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY mangler");
  return k;
}

async function stripeRequest(path: string, body: Record<string, string>): Promise<any> {
  const { key } = getStripeKey();
  const form = new URLSearchParams(body);
  const res = await fetch(`${STRIPE_GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getLovableKey()}`,
      "X-Connection-Api-Key": key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function formatPeriod(start: string, end: string): string {
  const months = [
    "januar", "februar", "mars", "april", "mai", "juni",
    "juli", "august", "september", "oktober", "november", "desember",
  ];
  const d = new Date(start);
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ============= CREATE CHECKOUT (partner-facing) =============
export const createPartnerInvoiceCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoiceId: z.string().uuid(),
      origin: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify the invoice belongs to this user
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("partner_invoices")
      .select("id, partner_account_id, amount_nok, status, period_start, period_end")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (invErr || !invoice) return { ok: false as const, error: "Faktura ikke funnet" };
    if (invoice.status === "paid") return { ok: false as const, error: "Allerede betalt" };
    if (invoice.amount_nok <= 0) return { ok: false as const, error: "Ugyldig beløp" };

    const { data: account } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, business_name")
      .eq("id", invoice.partner_account_id)
      .maybeSingle();
    if (!account) return { ok: false as const, error: "Ingen partnerkonto" };

    // Confirm requester owns this account
    const { data: myAccount } = await supabaseAdmin
      .from("partner_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("id", invoice.partner_account_id)
      .maybeSingle();
    if (!myAccount) return { ok: false as const, error: "Forbidden" };

    const periodLabel = formatPeriod(invoice.period_start, invoice.period_end);
    const origin = data.origin || SITE_URL;

    const session = await stripeRequest("/v1/checkout/sessions", {
      "mode": "payment",
      "currency": "nok",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "nok",
      "line_items[0][price_data][unit_amount]": String(invoice.amount_nok * 100),
      "line_items[0][price_data][product_data][name]":
        `Veiglede partnerannonsering – ${periodLabel}`,
      "line_items[0][price_data][product_data][description]":
        `Faktura for ${account.business_name}`,
      "metadata[invoiceId]": invoice.id,
      "metadata[partnerAccountId]": account.id,
      "success_url": `${origin}/partner/dashboard/invoices?paid=true&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `${origin}/partner/dashboard/invoices`,
      "payment_intent_data[description]": `Veiglede annonsering ${periodLabel}`,
    });

    // Store session id for reconciliation
    await supabaseAdmin
      .from("partner_invoices")
      .update({ stripe_session_id: session.id })
      .eq("id", invoice.id);

    return { ok: true as const, url: session.url as string };
  });

// ============= ADMIN: list all invoices =============
export const listAllInvoicesAdminFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    if (me?.role !== "admin") return { invoices: [] };

    const { data: invoices } = await supabaseAdmin
      .from("partner_invoices")
      .select("*")
      .order("period_end", { ascending: false });

    if (!invoices?.length) return { invoices: [] };

    const accountIds = Array.from(new Set(invoices.map((i) => i.partner_account_id)));
    const { data: accounts } = await supabaseAdmin
      .from("partner_accounts")
      .select("id, business_name")
      .in("id", accountIds);
    const nameMap = new Map((accounts ?? []).map((a) => [a.id, a.business_name]));

    return {
      invoices: invoices.map((i) => ({
        ...i,
        business_name: nameMap.get(i.partner_account_id) ?? "—",
      })),
    };
  });

// ============= ADMIN: manual mark paid =============
export const markInvoicePaidManuallyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ invoiceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    if (me?.role !== "admin") return { ok: false as const, error: "Forbidden" };

    const { error } = await supabaseAdmin
      .from("partner_invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_method: "manual",
      })
      .eq("id", data.invoiceId);

    return { ok: !error, error: error?.message };
  });
