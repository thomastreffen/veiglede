import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Category = z.enum(["mat", "overnatting", "attraksjon", "drivstoff", "annet"]);

// ============= REGISTER =============
export const registerPartnerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        // Account creds
        email: z.string().email(),
        password: z.string().min(8).max(200),
        // Business
        businessName: z.string().min(1).max(200),
        contactName: z.string().min(1).max(200),
        orgNumber: z.string().max(50).optional().nullable(),
        category: Category,
        website: z.string().url().optional().nullable(),
        logoUrl: z.string().url().optional().nullable(),
        description: z.string().max(200).optional().nullable(),
        // Location
        address: z.string().min(1).max(300),
        region: z.string().max(100).optional().nullable(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // 1. Create auth user
    const { data: signUp, error: authErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.contactName },
      });
    if (authErr || !signUp.user) {
      return { ok: false as const, error: authErr?.message ?? "Kunne ikke opprette konto" };
    }
    const userId = signUp.user.id;

    // 2. Create partner (public-facing entry, pending approval)
    const { data: partner, error: pErr } = await supabaseAdmin
      .from("partners")
      .insert({
        name: data.businessName,
        category: data.category,
        region: data.region ?? null,
        description: data.description ?? null,
        website: data.website ?? null,
        logo_url: data.logoUrl ?? null,
        lat: data.lat,
        lng: data.lng,
        is_active: false,
      })
      .select("id")
      .single();
    if (pErr || !partner) {
      return { ok: false as const, error: pErr?.message ?? "Kunne ikke lagre bedrift" };
    }

    // 3. Create partner_account
    const { error: aErr } = await supabaseAdmin.from("partner_accounts").insert({
      user_id: userId,
      partner_id: partner.id,
      business_name: data.businessName,
      contact_name: data.contactName,
      org_number: data.orgNumber ?? null,
      category: data.category,
      website: data.website ?? null,
      logo_url: data.logoUrl ?? null,
      status: "pending",
    });
    if (aErr) return { ok: false as const, error: aErr.message };

    // 4. Notify admins
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (admins?.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.id as string,
          type: "partner_signup",
          title: "Ny partner registrert",
          body: `${data.businessName} venter på godkjenning`,
          link: "/admin/advertisers",
        })),
      );
    }

    return { ok: true as const, userId };
  });

// ============= MY ACCOUNT =============
export const getMyPartnerAccountFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { account: null, partner: null };
    let partner = null;
    if (account.partner_id) {
      const { data: p } = await supabaseAdmin
        .from("partners")
        .select("id,name,category,region,lat,lng,description,logo_url,website,is_active")
        .eq("id", account.partner_id)
        .maybeSingle();
      partner = p;
    }
    return { account, partner };
  });

// ============= DASHBOARD =============
export const getMyDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id, partner_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { account: null, campaigns: [], stats: null };

    const { data: campaigns } = await supabase
      .from("partner_campaigns")
      .select("*")
      .eq("partner_account_id", account.id)
      .order("created_at", { ascending: false });

    // Stats this month — pulled from linked partner row
    let stats = { impressions: 0, clicks: 0, ctr: 0, estimatedCost: 0 };
    if (account.partner_id) {
      const { data: p } = await supabaseAdmin
        .from("partners")
        .select("impressions_this_month, clicks_this_month")
        .eq("id", account.partner_id)
        .maybeSingle();
      const imp = p?.impressions_this_month ?? 0;
      const clk = p?.clicks_this_month ?? 0;
      const ctr = imp > 0 ? (clk / imp) * 100 : 0;
      // Active CPM rate from first active campaign, fallback 15
      const activeCpm = (campaigns ?? []).find((c) => c.status === "active")?.cpm_rate ?? 15;
      stats = {
        impressions: imp,
        clicks: clk,
        ctr: Math.round(ctr * 10) / 10,
        estimatedCost: Math.round((imp / 1000) * activeCpm),
      };
    }

    return { account, campaigns: campaigns ?? [], stats };
  });

// ============= CAMPAIGN UPSERT =============
export const upsertCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        startsAt: z.string().min(8),
        endsAt: z.string().min(8),
        budgetNok: z.number().int().min(500).max(10_000_000),
        pricingModel: z.enum(["cpm", "fixed"]),
        cpmRate: z.number().int().min(1).max(1000).default(15),
        status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id, partner_id, business_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { ok: false as const, error: "Ingen partnerkonto" };

    const payload = {
      partner_account_id: account.id,
      partner_id: account.partner_id,
      name: data.name,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      budget_nok: data.budgetNok,
      pricing_model: data.pricingModel,
      cpm_rate: data.cpmRate,
      status: data.status,
    };

    if (data.id) {
      const { error } = await supabase
        .from("partner_campaigns")
        .update(payload)
        .eq("id", data.id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, id: data.id };
    }

    const { data: ins, error } = await supabase
      .from("partner_campaigns")
      .insert(payload)
      .select("id")
      .single();
    if (error || !ins) return { ok: false as const, error: error?.message ?? "Feil" };

    // Notify admins of new campaign
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (admins?.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.id as string,
          type: "partner_campaign_new",
          title: "Ny kampanje",
          body: `${account.business_name} opprettet "${data.name}"`,
          link: "/admin/advertisers",
        })),
      );
    }

    return { ok: true as const, id: ins.id };
  });

export const getCampaignFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("partner_campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return { campaign: row ?? null };
  });

export const setCampaignStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "active", "paused", "completed"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("partner_campaigns")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: !error, error: error?.message };
  });

// ============= INVOICES =============
export const listMyInvoicesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { invoices: [] };
    const { data } = await supabase
      .from("partner_invoices")
      .select("*")
      .eq("partner_account_id", account.id)
      .order("period_end", { ascending: false });
    return { invoices: data ?? [] };
  });

// ============= ADMIN =============
export const listPartnerAccountsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (me?.role !== "admin") return { accounts: [] };
    const { data: accounts } = await supabaseAdmin
      .from("partner_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    return { accounts: accounts ?? [] };
  });

export const setPartnerAccountStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "active", "suspended"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (me?.role !== "admin") return { ok: false as const, error: "Forbidden" };

    const { data: account, error } = await supabaseAdmin
      .from("partner_accounts")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("partner_id")
      .single();
    if (error || !account) return { ok: false as const, error: error?.message };

    if (account.partner_id) {
      await supabaseAdmin
        .from("partners")
        .update({ is_active: data.status === "active" })
        .eq("id", account.partner_id);
    }
    return { ok: true as const };
  });
