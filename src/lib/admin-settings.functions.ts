import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AdminSettings {
  site_name: string;
  contact_email: string;
  max_free_trips: number;
  max_free_vehicles: number;
  is_maintenance_mode: boolean;
  pro_monthly_nok: number;
  pro_yearly_nok: number;
  gruppe_monthly_nok: number;
  max_gruppe_members: number;
  default_cpm_nok: number;
  max_partner_radius_km: number;
  partner_auto_approve: boolean;
}

export const DEFAULT_SETTINGS: AdminSettings = {
  site_name: "Veiglede",
  contact_email: "kontakt@veiglede.no",
  max_free_trips: 10,
  max_free_vehicles: 2,
  is_maintenance_mode: false,
  pro_monthly_nok: 79,
  pro_yearly_nok: 599,
  gruppe_monthly_nok: 199,
  max_gruppe_members: 20,
  default_cpm_nok: 15,
  max_partner_radius_km: 50,
  partner_auto_approve: false,
};

const SettingsSchema = z.object({
  site_name: z.string().trim().min(1).max(100),
  contact_email: z.string().trim().email().max(255),
  max_free_trips: z.number().int().min(0).max(10000),
  max_free_vehicles: z.number().int().min(0).max(1000),
  is_maintenance_mode: z.boolean(),
  pro_monthly_nok: z.number().int().min(0).max(100000),
  pro_yearly_nok: z.number().int().min(0).max(1000000),
  gruppe_monthly_nok: z.number().int().min(0).max(100000),
  max_gruppe_members: z.number().int().min(1).max(1000),
  default_cpm_nok: z.number().int().min(0).max(100000),
  max_partner_radius_km: z.number().int().min(1).max(10000),
  partner_auto_approve: z.boolean(),
});

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
  if (!data || data.role !== "admin" || data.is_active === false) throw new Error("Forbidden");
}

export const getAdminSettingsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminSettings> => {
    const { data } = await supabaseAdmin.from("admin_settings").select("key, value");
    const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of data ?? []) out[r.key as string] = r.value as unknown;
    return out as unknown as AdminSettings;
  },
);

export const saveAdminSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminSettings) => SettingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const rows = Object.entries(data).map(([key, value]) => ({
      key,
      value: value as unknown as never,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    }));
    const { error } = await supabaseAdmin
      .from("admin_settings")
      .upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
