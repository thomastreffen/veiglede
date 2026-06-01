import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Wand2 } from "lucide-react";
import {
  listMyBenefitsFn,
  ensureMyBenefitProviderFn,
  upsertMyBenefitFn,
  deleteMyBenefitFn,
  getAudienceStatsFn,
} from "@/lib/benefits.functions";

export const Route = createFileRoute("/partner/dashboard/benefits")({
  component: PartnerBenefitsPage,
});

const VEHICLE_OPTS = [
  { value: "motorcycle", label: "MC" },
  { value: "car", label: "Bil" },
  { value: "rv", label: "Bobil" },
] as const;
const ENERGY_OPTS = [
  { value: "electric", label: "Elbil" },
  { value: "petrol", label: "Bensin" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
] as const;

const CATEGORIES = ["rekvisita", "verksted", "forsikring", "utstyr", "lading", "camping", "annet"] as const;

function randomCode(prefix = "VEIG") {
  return `${prefix}${Math.floor(Math.random() * 9000 + 1000)}`;
}

type BenefitInputT = {
  id?: string;
  title: string;
  description: string | null;
  discount_code: string | null;
  affiliate_url: string | null;
  direct_url: string;
  vehicle_types: Array<"motorcycle" | "car" | "rv">;
  energy_types: Array<"petrol" | "diesel" | "electric" | "hybrid">;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
};

function PartnerBenefitsPage() {
  const listFn = useServerFn(listMyBenefitsFn);
  const ensureFn = useServerFn(ensureMyBenefitProviderFn);
  const upsertFn = useServerFn(upsertMyBenefitFn);
  const deleteFn = useServerFn(deleteMyBenefitFn);
  const audFn = useServerFn(getAudienceStatsFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-benefits"], queryFn: () => listFn() });
  const { data: audience } = useQuery({ queryKey: ["audience-stats"], queryFn: () => audFn() });

  const ensure = useMutation({
    mutationFn: (i: { name: string; category: typeof CATEGORIES[number]; contact_email: string; website?: string; description?: string }) => ensureFn({ data: i }),
    onSuccess: (r) => { if (r.ok) { toast.success("Leverandørprofil lagret"); qc.invalidateQueries({ queryKey: ["my-benefits"] }); } else toast.error(r.error ?? "Feil"); },
  });
  const upsert = useMutation({
    mutationFn: (i: BenefitInputT) => upsertFn({ data: i }),
    onSuccess: (r) => { if (r.ok) { toast.success("Fordel lagret"); qc.invalidateQueries({ queryKey: ["my-benefits"] }); } else toast.error(r.error ?? "Feil"); },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Slettet"); qc.invalidateQueries({ queryKey: ["my-benefits"] }); },
  });

  const provider = data?.provider;

  if (isLoading) {
    return <div className="p-10 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-2xl px-4 md:px-8 py-10 space-y-6">
        <header>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Fordeler</p>
          <h1 className="mt-1 font-display text-3xl uppercase">Opprett leverandørprofil</h1>
          <p className="mt-2 text-sm text-[#1a1a1a]/65">Sett opp navnet og kategorien som vises i Veiglede Fordeler.</p>
        </header>
        <ProviderForm onSubmit={(p) => ensure.mutate(p)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-8 py-10 space-y-10">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Fordeler</p>
          <h1 className="mt-1 font-display text-3xl uppercase">{provider.name}</h1>
          <p className="mt-1 text-sm text-[#1a1a1a]/60">Status: <span className="font-medium">{provider.status}</span></p>
        </div>
      </header>

      {audience && audience.totalOptedIn > 0 && (
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-primary mb-1">Din målgruppe på Veiglede</p>
          <p>
            {(audience.byVehicleType.car ?? 0).toLocaleString("nb-NO")} bilister ·{" "}
            {(audience.byVehicleType.motorcycle ?? 0).toLocaleString("nb-NO")} MC-kjørere ·{" "}
            {(audience.byVehicleType.rv ?? 0).toLocaleString("nb-NO")} bobilister
          </p>
        </div>
      )}

      <section>
        <h2 className="font-display text-xl uppercase mb-4">Dine fordeler</h2>
        {data!.benefits.length === 0 ? (
          <p className="text-sm text-[#1a1a1a]/60">Ingen fordeler enda.</p>
        ) : (
          <div className="space-y-3">
            {data!.benefits.map((b) => (
              <div key={b.id} className="rounded-2xl border border-black/5 bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-display text-base">{b.title}</h3>
                  <p className="text-xs text-[#1a1a1a]/60 mt-1">
                    {b.impressions} visninger · {b.clicks} klikk · {b.code_copies} kode-kopier
                  </p>
                  {b.discount_code && <p className="mt-1 font-mono text-xs">{b.discount_code}</p>}
                </div>
                <button onClick={() => del.mutate(b.id)} className="text-xs text-red-600 inline-flex items-center gap-1.5 hover:underline">
                  <Trash2 className="h-3.5 w-3.5" /> Slett
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl uppercase mb-4">+ Legg til fordel</h2>
        <BenefitForm onSubmit={(b) => upsert.mutate(b)} providerName={provider.name} />
      </section>
    </div>
  );
}

function ProviderForm({ onSubmit }: { onSubmit: (i: { name: string; category: typeof CATEGORIES[number]; contact_email: string; website?: string; description?: string }) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("utstyr");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, category, contact_email: contact, website: website || undefined, description: description || undefined }); }} className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
      <Field label="Bedriftsnavn"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="Kategori">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number])}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Kontakt-epost"><input type="email" className="input" value={contact} onChange={(e) => setContact(e.target.value)} required /></Field>
      <Field label="Nettside (valgfritt)"><input type="url" className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." /></Field>
      <Field label="Beskrivelse (maks 300)"><textarea className="input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
      <button type="submit" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">Lagre</button>
      <style>{`.input{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.5rem;padding:.5rem .75rem;font-size:14px;background:white}`}</style>
    </form>
  );
}

function BenefitForm({ onSubmit, providerName }: { onSubmit: (i: BenefitInputT) => void; providerName: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [energyTypes, setEnergyTypes] = useState<string[]>([]);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            title,
            description: description || null,
            discount_code: code || null,
            direct_url: directUrl,
            affiliate_url: affiliateUrl || null,
            vehicle_types: vehicleTypes as Array<"motorcycle" | "car" | "rv">,
            energy_types: energyTypes as Array<"petrol" | "diesel" | "electric" | "hybrid">,
            valid_from: validFrom || null,
            valid_to: validTo || null,
            is_active: true,
          });
        }}
        className="space-y-4 rounded-2xl border border-black/10 bg-white p-5"
      >
        <Field label="Tittel"><input className="finput" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="15% rabatt på alt MC-utstyr" /></Field>
        <Field label="Beskrivelse (maks 300)"><textarea className="finput" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
        <Field label="Rabattkode">
          <div className="flex gap-2">
            <input className="finput flex-1" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VEIGLEDE15" />
            <button type="button" onClick={() => setCode(randomCode())} className="rounded-lg border border-black/10 px-3 text-xs inline-flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5" />Generer</button>
          </div>
        </Field>
        <Field label="Direkte URL"><input type="url" className="finput" value={directUrl} onChange={(e) => setDirectUrl(e.target.value)} required placeholder="https://din-webshop.no" /></Field>
        <Field label="Affiliate-lenke (valgfritt)"><input type="url" className="finput" value={affiliateUrl} onChange={(e) => setAffiliateUrl(e.target.value)} placeholder="https://..." /></Field>
        <Field label="Målgruppe (kjøretøy)">
          <div className="flex gap-2 flex-wrap">
            {VEHICLE_OPTS.map((v) => (
              <button key={v.value} type="button" onClick={() => toggle(vehicleTypes, setVehicleTypes, v.value)} className={`rounded-full border px-3 py-1 text-xs ${vehicleTypes.includes(v.value) ? "bg-primary text-primary-foreground border-primary" : "border-black/10"}`}>{v.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Drivlinje (valgfritt)">
          <div className="flex gap-2 flex-wrap">
            {ENERGY_OPTS.map((v) => (
              <button key={v.value} type="button" onClick={() => toggle(energyTypes, setEnergyTypes, v.value)} className={`rounded-full border px-3 py-1 text-xs ${energyTypes.includes(v.value) ? "bg-primary text-primary-foreground border-primary" : "border-black/10"}`}>{v.label}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gyldig fra"><input type="date" className="finput" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></Field>
          <Field label="Gyldig til"><input type="date" className="finput" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></Field>
        </div>
        <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground">
          <Plus className="h-4 w-4" /> Lagre fordel
        </button>
        <style>{`.finput{width:100%;border:1px solid rgba(0,0,0,.1);border-radius:.5rem;padding:.5rem .75rem;font-size:14px;background:white}`}</style>
      </form>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-[#1a1a1a]/55 mb-2">Forhåndsvisning</p>
        <article className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
          <header>
            <p className="text-xs uppercase tracking-wider text-[#1a1a1a]/55">{providerName}</p>
            <h3 className="font-display text-base">{title || "Tittel her"}</h3>
          </header>
          {description && <p className="text-sm text-[#1a1a1a]/65">{description}</p>}
          <div className="flex gap-2">
            {code && <span className="flex-1 text-center rounded-xl border border-dashed border-primary/50 py-2 text-sm font-mono">{code}</span>}
            <span className="flex-1 text-center rounded-xl bg-primary text-primary-foreground py-2 text-sm font-semibold">Gå til {providerName}</span>
          </div>
        </article>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#1a1a1a]/70">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
