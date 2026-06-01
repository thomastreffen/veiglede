import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdminSettingsFn,
  saveAdminSettingsFn,
  DEFAULT_SETTINGS,
  type AdminSettings,
} from "@/lib/admin-settings.functions";
import { Save } from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Innstillinger — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const qc = useQueryClient();
  const load = useServerFn(getAdminSettingsFn);
  const save = useServerFn(saveAdminSettingsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => load(),
    staleTime: 30_000,
  });
  const [form, setForm] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const update = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ data: form });
      toast.success("Innstillinger lagret");
      await qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Klarte ikke lagre");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-400">Laster innstillinger…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">System</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Innstillinger</h1>
          <p className="mt-1 text-xs text-slate-400">Systembrede innstillinger for plattformen.</p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Lagrer…" : "Lagre innstillinger"}
        </button>
      </header>

      <Section title="Plattform-innstillinger">
        <TextField label="Sitenavn" value={form.site_name} onChange={(v) => update("site_name", v)} />
        <TextField label="Kontakt-epost" value={form.contact_email} onChange={(v) => update("contact_email", v)} type="email" />
        <NumberField label="Maks gratis turer" value={form.max_free_trips} onChange={(v) => update("max_free_trips", v)} />
        <NumberField label="Maks gratis kjøretøy" value={form.max_free_vehicles} onChange={(v) => update("max_free_vehicles", v)} />
        <ToggleField
          label="Vedlikeholdsmodus"
          hint="Viser banner til alle brukere."
          checked={form.is_maintenance_mode}
          onChange={(v) => update("is_maintenance_mode", v)}
        />
      </Section>

      <Section title="Abonnement-priser">
        <NumberField label="Pro månedspris (NOK)" value={form.pro_monthly_nok} onChange={(v) => update("pro_monthly_nok", v)} />
        <NumberField label="Pro årspris (NOK)" value={form.pro_yearly_nok} onChange={(v) => update("pro_yearly_nok", v)} />
        <NumberField label="Gruppe månedspris (NOK)" value={form.gruppe_monthly_nok} onChange={(v) => update("gruppe_monthly_nok", v)} />
        <NumberField label="Maks gruppe-medlemmer" value={form.max_gruppe_members} onChange={(v) => update("max_gruppe_members", v)} />
      </Section>

      <Section title="Partner-innstillinger">
        <NumberField label="Standard CPM-rate (NOK)" value={form.default_cpm_nok} onChange={(v) => update("default_cpm_nok", v)} />
        <NumberField label="Maks partner-radius (km)" value={form.max_partner_radius_km} onChange={(v) => update("max_partner_radius_km", v)} />
        <ToggleField
          label="Auto-godkjenn partnere"
          hint="Nye partnersøknader aktiveres automatisk."
          checked={form.partner_auto_approve}
          onChange={(v) => update("partner_auto_approve", v)}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="p-5 border-b border-slate-800">
        <h2 className="font-display text-lg uppercase">{title}</h2>
      </div>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary";

function TextField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={inputCls}
      />
    </label>
  );
}

function ToggleField({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer md:col-span-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary mt-0.5 h-4 w-4"
      />
      <div>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </div>
    </label>
  );
}
