import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getCampaignFn, upsertCampaignFn } from "@/lib/partner.functions";

export const Route = createFileRoute("/partner/dashboard/campaign/$id")({
  component: EditCampaign,
});

function EditCampaign() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetcher = useServerFn(getCampaignFn);
  const upsert = useServerFn(upsertCampaignFn);
  const { data, isLoading } = useQuery({
    queryKey: ["partner-campaign", id],
    queryFn: () => fetcher({ data: { id } }),
  });

  const [form, setForm] = useState({
    name: "",
    startsAt: "",
    endsAt: "",
    budget: 1000,
    pricing: "cpm" as "cpm" | "fixed",
    cpm: 15,
    status: "draft" as "draft" | "active" | "paused" | "completed",
  });

  useEffect(() => {
    if (data?.campaign) {
      setForm({
        name: data.campaign.name,
        startsAt: data.campaign.starts_at,
        endsAt: data.campaign.ends_at,
        budget: data.campaign.budget_nok,
        pricing: data.campaign.pricing_model,
        cpm: data.campaign.cpm_rate,
        status: data.campaign.status,
      });
    }
  }, [data?.campaign]);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id,
          name: form.name,
          startsAt: form.startsAt,
          endsAt: form.endsAt,
          budgetNok: form.budget,
          pricingModel: form.pricing,
          cpmRate: form.cpm,
          status: form.status,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) navigate({ to: "/partner/dashboard" });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 md:px-8 py-16 grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.campaign) {
    return <div className="mx-auto max-w-2xl px-4 md:px-8 py-16">Kampanje ikke funnet.</div>;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 md:px-8 py-12 md:py-16">
      <h1 className="font-display text-3xl uppercase">Rediger kampanje</h1>

      <div className="mt-8 space-y-5">
        <Field label="Kampanjenavn">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fra dato">
            <input type="date" className={inputCls} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </Field>
          <Field label="Til dato">
            <input type="date" className={inputCls} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </Field>
        </div>
        <Field label="Budsjett (NOK)">
          <input type="number" min={500} step={100} className={inputCls} value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
        </Field>
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#1a1a1a]/60">Status</label>
          <select
            className={`${inputCls} mt-1.5`}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
          >
            <option value="draft">Utkast</option>
            <option value="active">Aktiv</option>
            <option value="paused">Pauset</option>
            <option value="completed">Avsluttet</option>
          </select>
        </div>

        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Lagre endringer
        </button>
      </div>
    </section>
  );
}

const inputCls =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm focus:border-primary focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#1a1a1a]/60">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
