import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getMyPartnerAccountFn, upsertCampaignFn } from "@/lib/partner.functions";

export const Route = createFileRoute("/partner/dashboard/campaign/new")({
  component: NewCampaign,
});

function NewCampaign() {
  const navigate = useNavigate();
  const accountFn = useServerFn(getMyPartnerAccountFn);
  const upsert = useServerFn(upsertCampaignFn);
  const { data: acc } = useQuery({ queryKey: ["partner-account"], queryFn: () => accountFn() });

  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [budget, setBudget] = useState(1000);
  const [pricing, setPricing] = useState<"cpm" | "fixed">("cpm");
  const cpm = 15;

  const estImpressions = useMemo(() => {
    if (pricing === "cpm") return Math.round((budget / cpm) * 1000);
    return null;
  }, [budget, pricing]);

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          name,
          startsAt,
          endsAt,
          budgetNok: budget,
          pricingModel: pricing,
          cpmRate: cpm,
          status: "draft",
        },
      }),
    onSuccess: (res) => {
      if (res.ok) navigate({ to: "/partner/dashboard" });
    },
  });

  const valid = name && startsAt && endsAt && budget >= 500;

  return (
    <section className="mx-auto max-w-2xl px-4 md:px-8 py-12 md:py-16">
      <h1 className="font-display text-3xl uppercase">Ny kampanje</h1>
      {acc?.partner && (
        <p className="mt-2 text-sm text-[#1a1a1a]/60">
          Knyttet til: <span className="font-medium text-[#1a1a1a]">{acc.partner.name}</span>
          {acc.partner.region ? ` · ${acc.partner.region}` : ""}
        </p>
      )}

      <div className="mt-8 space-y-5">
        <Field label="Kampanjenavn">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fra dato">
            <input type="date" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label="Til dato">
            <input type="date" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
        </div>

        <Field label="Budsjett (NOK)">
          <input
            type="number"
            min={500}
            step={100}
            className={inputCls}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-[#1a1a1a]/55">Minimum 500 kr.</p>
        </Field>

        <div>
          <label className="block text-xs uppercase tracking-wider text-[#1a1a1a]/60">Prismodell</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["cpm", "fixed"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPricing(p)}
                className={`rounded-xl border px-4 py-3 text-sm text-left ${
                  pricing === p
                    ? "border-primary bg-primary/5"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                <div className="font-semibold">
                  {p === "cpm" ? "CPM" : "Fast månedspris"}
                </div>
                <div className="text-xs text-[#1a1a1a]/55 mt-0.5">
                  {p === "cpm" ? "15 kr per 1000 visninger" : "Fast pris uavhengig av visninger"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {estImpressions !== null && (
          <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-sm text-[#1a1a1a]/80">
            Med <strong>{budget.toLocaleString("nb-NO")} kr</strong> budsjett og{" "}
            <strong>{cpm} kr CPM</strong> får du estimert{" "}
            <strong>{estImpressions.toLocaleString("nb-NO")} visninger</strong>.
          </div>
        )}

        <button
          type="button"
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Lagre utkast
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
