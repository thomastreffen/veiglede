import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  adminListBenefitProvidersFn,
  adminSetProviderStatusFn,
  adminCreateProviderFn,
} from "@/lib/benefits.functions";

export const Route = createFileRoute("/admin/benefits")({
  component: AdminBenefitsPage,
});

const CATEGORIES = ["rekvisita", "verksted", "forsikring", "utstyr", "lading", "camping", "annet"] as const;

function AdminBenefitsPage() {
  const listFn = useServerFn(adminListBenefitProvidersFn);
  const setStatusFn = useServerFn(adminSetProviderStatusFn);
  const createFn = useServerFn(adminCreateProviderFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-benefits"], queryFn: () => listFn() });
  const [showAdd, setShowAdd] = useState(false);

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "pending" | "active" | "suspended" }) => setStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-benefits"] }),
  });
  const create = useMutation({
    mutationFn: (v: { name: string; category: typeof CATEGORIES[number]; contact_email: string; website?: string; monthly_fee_nok: number }) => createFn({ data: v }),
    onSuccess: (r) => {
      if (r.ok) { toast.success("Leverandør opprettet"); setShowAdd(false); qc.invalidateQueries({ queryKey: ["admin-benefits"] }); }
      else toast.error(r.error ?? "Feil");
    },
  });

  if (isLoading) return <div className="py-20 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Fordeler</p>
          <h1 className="mt-1 font-display text-3xl uppercase">Leverandører og fordeler</h1>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-primary-foreground">
          <Plus className="h-4 w-4" /> Legg til leverandør
        </button>
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Leverandører" value={String(data?.providers.length ?? 0)} />
        <Stat label="Aktive fordeler" value={String(data?.benefits.filter((b) => b.is_active).length ?? 0)} />
        <Stat label="Månedlig inntekt" value={`${(data?.mrr ?? 0).toLocaleString("nb-NO")} kr`} />
      </div>

      {showAdd && (
        <AddProviderForm onSubmit={(v) => create.mutate(v)} />
      )}

      <section>
        <h2 className="font-display text-xl uppercase mb-3">Leverandører</h2>
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr><th className="text-left p-3">Navn</th><th className="text-left p-3">Kategori</th><th className="text-left p-3">Status</th><th className="text-right p-3">Mnd. avg.</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {data?.providers.map((p) => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 text-slate-400">{p.category}</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3 text-right">{(p.monthly_fee_nok ?? 0).toLocaleString("nb-NO")} kr</td>
                  <td className="p-3 text-right">
                    <select
                      value={p.status}
                      onChange={(e) => setStatus.mutate({ id: p.id, status: e.target.value as "pending" | "active" | "suspended" })}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl uppercase mb-3">Alle fordeler</h2>
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr><th className="text-left p-3">Tittel</th><th className="text-left p-3">Kode</th><th className="text-right p-3">Visninger</th><th className="text-right p-3">Klikk</th><th className="text-right p-3">Kopier</th></tr>
            </thead>
            <tbody>
              {data?.benefits.map((b) => (
                <tr key={b.id} className="border-t border-slate-800">
                  <td className="p-3">{b.title}</td>
                  <td className="p-3 font-mono text-xs">{b.discount_code ?? "—"}</td>
                  <td className="p-3 text-right">{b.impressions}</td>
                  <td className="p-3 text-right">{b.clicks}</td>
                  <td className="p-3 text-right">{b.code_copies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl">{value}</p>
    </div>
  );
}

function AddProviderForm({ onSubmit }: { onSubmit: (v: { name: string; category: typeof CATEGORIES[number]; contact_email: string; website?: string; monthly_fee_nok: number }) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("utstyr");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [fee, setFee] = useState(499);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, category, contact_email: contact, website: website || undefined, monthly_fee_nok: fee }); }} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 grid md:grid-cols-2 gap-3">
      <input className="binp" placeholder="Navn" value={name} onChange={(e) => setName(e.target.value)} required />
      <select className="binp" value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <input className="binp" type="email" placeholder="Kontakt-epost" value={contact} onChange={(e) => setContact(e.target.value)} required />
      <input className="binp" type="url" placeholder="https://..." value={website} onChange={(e) => setWebsite(e.target.value)} />
      <input className="binp" type="number" placeholder="Mnd. avg." value={fee} onChange={(e) => setFee(Number(e.target.value))} />
      <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground">Opprett</button>
      <style>{`.binp{background:#0f172a;border:1px solid #1e293b;color:#fff;border-radius:.5rem;padding:.5rem .75rem;font-size:14px}`}</style>
    </form>
  );
}
