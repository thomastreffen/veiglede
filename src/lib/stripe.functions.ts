import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// NOTE: Live Stripe checkout will be wired here when the integration goes live.
// For now we only expose admin read + manual mark-paid so the rest of the
// invoice UI is fully functional without a payment processor.

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
