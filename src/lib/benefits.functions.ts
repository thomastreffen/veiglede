import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Category = z.enum([
  "rekvisita",
  "verksted",
  "forsikring",
  "utstyr",
  "lading",
  "camping",
  "annet",
]);

// ============ CONSENT ============
export const getMyConsentFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_benefit_consents")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: profile } = await supabase
      .from("profiles")
      .select("benefits_opt_in")
      .eq("id", userId)
      .maybeSingle();
    return {
      consent: data ?? {
        user_id: userId,
        consent_targeting: false,
        consent_analytics: false,
        consented_at: null,
        updated_at: null,
      },
      benefitsOptIn: profile?.benefits_opt_in ?? false,
    };
  });

export const updateMyConsentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      consent_targeting: z.boolean(),
      consent_analytics: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_benefit_consents")
      .upsert({
        user_id: userId,
        consent_targeting: data.consent_targeting,
        consent_analytics: data.consent_analytics,
        consented_at: now,
        updated_at: now,
      });
    if (error) return { ok: false as const, error: error.message };
    const optIn = data.consent_targeting || data.consent_analytics;
    await supabase.from("profiles").update({ benefits_opt_in: optIn }).eq("id", userId);
    return { ok: true as const };
  });

// ============ PUBLIC LIST ============
export const listBenefitsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: providers } = await supabase
      .from("benefit_providers")
      .select("id,name,logo_url,website,category,status")
      .eq("status", "active");
    const { data: benefits } = await supabase
      .from("benefits")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    return {
      providers: providers ?? [],
      benefits: benefits ?? [],
    };
  });

// ============ TRACKING ============
const TrackInput = z.object({ benefit_id: z.string().uuid() });

export const trackBenefitImpressionFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TrackInput.parse(i))
  .handler(async ({ data }) => {
    await supabaseAdmin.rpc("increment_benefit_impression", { p_benefit_id: data.benefit_id });
    return { ok: true };
  });

export const trackBenefitClickFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TrackInput.parse(i))
  .handler(async ({ data }) => {
    await supabaseAdmin.rpc("increment_benefit_click", { p_benefit_id: data.benefit_id });
    return { ok: true };
  });

export const trackBenefitCodeCopyFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TrackInput.parse(i))
  .handler(async ({ data }) => {
    await supabaseAdmin.rpc("increment_benefit_code_copy", { p_benefit_id: data.benefit_id });
    return { ok: true };
  });

// ============ PARTNER (own benefits) ============
export const listMyBenefitsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { provider: null, benefits: [] };
    const { data: provider } = await supabaseAdmin
      .from("benefit_providers")
      .select("*")
      .eq("partner_account_id", account.id)
      .maybeSingle();
    if (!provider) return { provider: null, benefits: [] };
    const { data: benefits } = await supabaseAdmin
      .from("benefits")
      .select("*")
      .eq("provider_id", provider.id)
      .order("created_at", { ascending: false });
    return { provider, benefits: benefits ?? [] };
  });

export const ensureMyBenefitProviderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().min(1).max(200),
      category: Category,
      website: z.string().url().optional().nullable(),
      logo_url: z.string().url().optional().nullable(),
      description: z.string().max(300).optional().nullable(),
      contact_email: z.string().email(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { ok: false as const, error: "Ingen partnerkonto" };
    const { data: existing } = await supabaseAdmin
      .from("benefit_providers")
      .select("id")
      .eq("partner_account_id", account.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("benefit_providers")
        .update({
          name: data.name,
          category: data.category,
          website: data.website ?? null,
          logo_url: data.logo_url ?? null,
          description: data.description ?? null,
          contact_email: data.contact_email,
        })
        .eq("id", existing.id);
      return error ? { ok: false as const, error: error.message } : { ok: true as const, id: existing.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("benefit_providers")
      .insert({
        partner_account_id: account.id,
        name: data.name,
        category: data.category,
        website: data.website ?? null,
        logo_url: data.logo_url ?? null,
        description: data.description ?? null,
        contact_email: data.contact_email,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !ins) return { ok: false as const, error: error?.message ?? "Feil" };
    return { ok: true as const, id: ins.id };
  });

const BenefitInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(300).optional().nullable(),
  discount_code: z.string().max(50).optional().nullable(),
  affiliate_url: z.string().url().optional().nullable(),
  direct_url: z.string().url(),
  vehicle_types: z.array(z.enum(["motorcycle", "car", "rv"])).default([]),
  energy_types: z.array(z.enum(["petrol", "diesel", "electric", "hybrid"])).default([]),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const upsertMyBenefitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BenefitInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!account) return { ok: false as const, error: "Ingen partnerkonto" };
    const { data: provider } = await supabaseAdmin
      .from("benefit_providers")
      .select("id")
      .eq("partner_account_id", account.id)
      .maybeSingle();
    if (!provider) return { ok: false as const, error: "Opprett leverandørprofil først" };

    const payload = {
      provider_id: provider.id,
      title: data.title,
      description: data.description ?? null,
      discount_code: data.discount_code ?? null,
      affiliate_url: data.affiliate_url ?? null,
      direct_url: data.direct_url,
      vehicle_types: data.vehicle_types,
      energy_types: data.energy_types,
      valid_from: data.valid_from || null,
      valid_to: data.valid_to || null,
      is_active: data.is_active,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("benefits").update(payload).eq("id", data.id);
      return error ? { ok: false as const, error: error.message } : { ok: true as const, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("benefits")
      .insert(payload)
      .select("id")
      .single();
    if (error || !ins) return { ok: false as const, error: error?.message ?? "Feil" };
    return { ok: true as const, id: ins.id };
  });

export const deleteMyBenefitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: account } = await supabase
      .from("partner_accounts").select("id").eq("user_id", userId).maybeSingle();
    if (!account) return { ok: false as const };
    const { data: provider } = await supabaseAdmin
      .from("benefit_providers").select("id").eq("partner_account_id", account.id).maybeSingle();
    if (!provider) return { ok: false as const };
    await supabaseAdmin.from("benefits").delete().eq("id", data.id).eq("provider_id", provider.id);
    return { ok: true as const };
  });

// ============ ADMIN ============
async function ensureAdmin(supabase: typeof supabaseAdmin, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

export const adminListBenefitProvidersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await ensureAdmin(supabaseAdmin, context.userId))) return { providers: [], benefits: [], mrr: 0 };
    const { data: providers } = await supabaseAdmin
      .from("benefit_providers").select("*").order("created_at", { ascending: false });
    const { data: benefits } = await supabaseAdmin
      .from("benefits").select("*").order("created_at", { ascending: false });
    const mrr = (providers ?? [])
      .filter((p) => p.status === "active")
      .reduce((s, p) => s + (p.monthly_fee_nok ?? 0), 0);
    return { providers: providers ?? [], benefits: benefits ?? [], mrr };
  });

export const adminSetProviderStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "active", "suspended"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(supabaseAdmin, context.userId))) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("benefit_providers").update({ status: data.status }).eq("id", data.id);
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  });

export const adminCreateProviderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().min(1).max(200),
      category: Category,
      contact_email: z.string().email(),
      website: z.string().url().optional().nullable(),
      monthly_fee_nok: z.number().int().min(0).max(100000).default(499),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!(await ensureAdmin(supabaseAdmin, context.userId))) return { ok: false as const };
    const { error, data: ins } = await supabaseAdmin.from("benefit_providers").insert({
      name: data.name,
      category: data.category,
      contact_email: data.contact_email,
      website: data.website ?? null,
      monthly_fee_nok: data.monthly_fee_nok,
      status: "active",
    }).select("id").single();
    return error || !ins ? { ok: false as const, error: error?.message } : { ok: true as const, id: ins.id };
  });

// ============ AUDIENCE STATS (anonymized) ============
export const getAudienceStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    // Only count users who consented to analytics
    const { data: consents } = await supabaseAdmin
      .from("user_benefit_consents")
      .select("user_id")
      .eq("consent_analytics", true);
    const userIds = (consents ?? []).map((c) => c.user_id);
    if (userIds.length === 0) {
      return {
        totalOptedIn: 0,
        byVehicleType: {} as Record<string, number>,
        byEnergyType: {} as Record<string, number>,
        byRegion: {} as Record<string, number>,
        avgTripsPerUser: 0,
        avgKmPerUser: 0,
      };
    }

    const { data: vehiclesRows } = await supabaseAdmin
      .from("vehicles").select("user_id,data").in("user_id", userIds);
    const byVehicleType: Record<string, number> = {};
    const byEnergyType: Record<string, number> = {};
    for (const row of vehiclesRows ?? []) {
      const arr: unknown = (row.data as { vehicles?: unknown })?.vehicles;
      if (!Array.isArray(arr)) continue;
      for (const v of arr) {
        const t = (v as { type?: string }).type;
        const e = (v as { energy?: string }).energy;
        if (t) byVehicleType[t] = (byVehicleType[t] ?? 0) + 1;
        if (e) {
          const k = e.startsWith("hybrid") ? "hybrid" : e;
          byEnergyType[k] = (byEnergyType[k] ?? 0) + 1;
        }
      }
    }

    const { data: tripRows } = await supabaseAdmin
      .from("trips").select("user_id,data").in("user_id", userIds);
    const byRegion: Record<string, number> = {};
    let tripCount = 0;
    let kmTotal = 0;
    for (const row of tripRows ?? []) {
      const trips: unknown = (row.data as { trips?: unknown })?.trips;
      if (!Array.isArray(trips)) continue;
      for (const t of trips) {
        tripCount += 1;
        const region = (t as { region?: string }).region;
        if (region) byRegion[region] = (byRegion[region] ?? 0) + 1;
        const km = (t as { distanceKm?: number }).distanceKm;
        if (typeof km === "number") kmTotal += km;
      }
    }

    return {
      totalOptedIn: userIds.length,
      byVehicleType,
      byEnergyType,
      byRegion,
      avgTripsPerUser: userIds.length ? Math.round((tripCount / userIds.length) * 10) / 10 : 0,
      avgKmPerUser: userIds.length ? Math.round(kmTotal / userIds.length) : 0,
    };
  });
