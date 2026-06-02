import { useEffect, useMemo, useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Sparkles, Tag, Loader2, Info } from "lucide-react";
import {
  listBenefitsFn,
  getMyConsentFn,
  trackBenefitImpressionFn,
  trackBenefitClickFn,
  trackBenefitCodeCopyFn,
} from "@/lib/benefits.functions";
import { useVehicles } from "@/lib/vehicles-store";
import { useT } from "@/i18n/provider";

export const Route = createFileRoute("/_app/fordeler")({
  head: () => ({ meta: [
    { title: "Fordeler — Veiglede" },
    { name: "description", content: "Eksklusive rabatter og fordeler for Veiglede-brukere." },
  ] }),
  component: FordelerPage,
});

function FordelerPage() {
  const t = useT();
  const fd = t.fordeler;
  const CATEGORIES = [
    { value: "all", label: fd.catAll },
    { value: "utstyr", label: fd.catUtstyr },
    { value: "verksted", label: fd.catVerksted },
    { value: "forsikring", label: fd.catForsikring },
    { value: "lading", label: fd.catLading },
    { value: "camping", label: fd.catCamping },
  ] as const;
  const listFn = useServerFn(listBenefitsFn);
  const consentFn = useServerFn(getMyConsentFn);
  const { data, isLoading } = useQuery({ queryKey: ["benefits-list"], queryFn: () => listFn() });
  const { data: consentData } = useQuery({ queryKey: ["my-consent"], queryFn: () => consentFn() });
  const { vehicles } = useVehicles();
  const [filter, setFilter] = useState<string>("all");

  const targetingOn = consentData?.consent.consent_targeting === true;
  const userVehicleTypes = useMemo(() => new Set(vehicles.map((v) => v.type)), [vehicles]);
  const userEnergies = useMemo(() => new Set(vehicles.map((v) => {
    const e = v.energy;
    return e.startsWith("hybrid") ? "hybrid" : e;
  })), [vehicles]);

  const providers = data?.providers ?? [];
  const providerById = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const benefits = data?.benefits ?? [];

  const filtered = useMemo(() => {
    return benefits.filter((b) => {
      const provider = providerById[b.provider_id];
      if (!provider) return false;
      if (filter !== "all" && provider.category !== filter) return false;
      return true;
    });
  }, [benefits, providerById, filter]);

  const personalized = useMemo(() => {
    if (!targetingOn) return [];
    return filtered.filter((b) => {
      const matchVehicle = (b.vehicle_types?.length ?? 0) === 0 || b.vehicle_types.some((t: string) => userVehicleTypes.has(t as never));
      const matchEnergy = (b.energy_types?.length ?? 0) === 0 || b.energy_types.some((t: string) => userEnergies.has(t as never));
      return matchVehicle && matchEnergy && (b.vehicle_types?.length || b.energy_types?.length);
    });
  }, [filtered, targetingOn, userVehicleTypes, userEnergies]);

  return (
    <div className="space-y-8 py-6 md:py-10">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Veiglede Fordeler</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Rabatter for deg på veien</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">Eksklusive rabatter for Veiglede-brukere — hos verksteder, utstyrsbutikker, ladeoperatører og mer.</p>
        </div>
      </header>

      {!consentData?.consent.consent_targeting && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1">
            <p>Slå på fordeler i <Link to="/settings" className="underline font-medium">profilen din</Link> for å se tilbud tilpasset ditt kjøretøy.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setFilter(c.value)}
            className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
              filter === c.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {targetingOn && personalized.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg uppercase tracking-wide">Basert på din garasje 🏍️</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personalized.map((b) => (
                  <BenefitCard key={b.id} benefit={b} provider={providerById[b.provider_id]} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg uppercase tracking-wide mb-3">Alle fordeler</h2>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen fordeler i denne kategorien enda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((b) => (
                  <BenefitCard key={b.id} benefit={b} provider={providerById[b.provider_id]} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

type Provider = { id: string; name: string; logo_url: string | null; category: string };
type Benefit = {
  id: string;
  provider_id: string;
  title: string;
  description: string | null;
  discount_code: string | null;
  affiliate_url: string | null;
  direct_url: string;
  vehicle_types: string[];
  energy_types: string[];
  valid_from: string | null;
  valid_to: string | null;
};

function BenefitCard({ benefit, provider }: { benefit: Benefit; provider?: Provider }) {
  const t = useT();
  const fd = t.fordeler;
  const VEHICLE_BADGES: Record<string, { emoji: string; label: string }> = {
    motorcycle: { emoji: "🏍️", label: fd.vbMC },
    car: { emoji: "🚗", label: fd.vbCar },
    rv: { emoji: "🚐", label: fd.vbRv },
  };
  const ENERGY_BADGES: Record<string, { emoji: string; label: string }> = {
    electric: { emoji: "⚡", label: fd.ebElectric },
    petrol: { emoji: "⛽", label: fd.ebPetrol },
    diesel: { emoji: "🛢️", label: fd.ebDiesel },
    hybrid: { emoji: "🔋", label: fd.ebHybrid },
  };
  const impFn = useServerFn(trackBenefitImpressionFn);
  const clickFn = useServerFn(trackBenefitClickFn);
  const copyFn = useServerFn(trackBenefitCodeCopyFn);
  const trackImpression = useMutation({ mutationFn: () => impFn({ data: { benefit_id: benefit.id } }) });
  const trackClick = useMutation({ mutationFn: () => clickFn({ data: { benefit_id: benefit.id } }) });
  const trackCopy = useMutation({ mutationFn: () => copyFn({ data: { benefit_id: benefit.id } }) });
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const key = `benefit-imp-${benefit.id}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;
    fired.current = true;
    try { sessionStorage.setItem(key, "1"); } catch { /* noop */ }
    trackImpression.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benefit.id]);

  const onCopy = async () => {
    if (!benefit.discount_code) return;
    try {
      await navigator.clipboard.writeText(benefit.discount_code);
      toast.success(fd.codeCopied(benefit.discount_code));
      trackCopy.mutate();
    } catch {
      toast.error(fd.copyFailed);
    }
  };

  const onGoto = () => {
    trackClick.mutate();
    const url = benefit.affiliate_url || benefit.direct_url;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <article className="rounded-2xl border border-border bg-surface/60 p-5 flex flex-col gap-4">
      <header className="flex items-center gap-3">
        {provider?.logo_url ? (
          <img src={provider.logo_url} alt={provider.name} className="h-10 w-10 rounded-lg object-cover bg-background border border-border" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center font-bold">
            {provider?.name.charAt(0) ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{provider?.name ?? fd.provider}</p>
          <h3 className="font-display text-base leading-tight">{benefit.title}</h3>
        </div>
      </header>

      {benefit.description && (
        <p className="text-sm text-muted-foreground">{benefit.description}</p>
      )}

      <div className="flex gap-1.5 flex-wrap text-[10px]">
        {benefit.vehicle_types.map((vt) => VEHICLE_BADGES[vt] && (
          <span key={vt} className="rounded-full bg-background border border-border px-2 py-0.5">
            {VEHICLE_BADGES[vt].emoji} {VEHICLE_BADGES[vt].label}
          </span>
        ))}
        {benefit.energy_types.map((et) => ENERGY_BADGES[et] && (
          <span key={et} className="rounded-full bg-background border border-border px-2 py-0.5">
            {ENERGY_BADGES[et].emoji} {ENERGY_BADGES[et].label}
          </span>
        ))}
      </div>

      {(benefit.valid_from || benefit.valid_to) && (
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {benefit.valid_from ?? "—"} → {benefit.valid_to ?? "—"}
        </p>
      )}

      <div className="flex gap-2 mt-auto">
        {benefit.discount_code && (
          <button
            type="button"
            onClick={onCopy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 px-3 py-2.5 text-sm font-mono font-semibold hover:bg-primary/5"
          >
            <Copy className="h-3.5 w-3.5" /> {benefit.discount_code}
          </button>
        )}
        <button
          type="button"
          onClick={onGoto}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          {fd.goTo(provider?.name ?? fd.provider)} <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}


export { Tag };
