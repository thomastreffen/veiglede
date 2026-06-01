import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { getMyConsentFn, updateMyConsentFn } from "@/lib/benefits.functions";

export function BenefitsConsent() {
  const getFn = useServerFn(getMyConsentFn);
  const updFn = useServerFn(updateMyConsentFn);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-consent"], queryFn: () => getFn() });
  const [targeting, setTargeting] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (data) {
      setTargeting(data.consent.consent_targeting);
      setAnalytics(data.consent.consent_analytics);
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: (input: { consent_targeting: boolean; consent_analytics: boolean }) =>
      updFn({ data: input }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("Kunne ikke lagre");
        return;
      }
      toast.success("Innstillinger lagret");
      qc.invalidateQueries({ queryKey: ["my-consent"] });
    },
  });

  const save = (t: boolean, a: boolean) => {
    setTargeting(t);
    setAnalytics(a);
    mut.mutate({ consent_targeting: t, consent_analytics: a });
  };

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5 md:p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl uppercase">Personvern og samtykke</h2>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Veiglede Fordeler</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Vi kan vise deg relevante rabatter og fordeler basert på kjøretøyene i garasjen din.
        Vi deler aldri persondata med tredjeparter — kun anonymisert statistikk.
      </p>

      <div className="mt-5 space-y-4">
        <Toggle
          checked={targeting}
          onChange={(v) => save(v, analytics)}
          title="Vis meg relevante fordeler basert på kjøretøy"
          subtitle="Aktiverer målrettede tilbud fra MC-utstyr, verksted og tilbehør tilpasset det du kjører"
        />
        <Toggle
          checked={analytics}
          onChange={(v) => save(targeting, v)}
          title="Bidra til anonym statistikk"
          subtitle="Hjelper oss å vise leverandører aggregert info om kjøretøytyper — ingen persondata deles"
        />
      </div>

      <a
        href="https://veiglede.no/personvern"
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-block text-xs underline text-muted-foreground hover:text-foreground"
      >
        Les vår personvernerklæring →
      </a>
    </section>
  );
}

function Toggle({
  checked, onChange, title, subtitle,
}: { checked: boolean; onChange: (v: boolean) => void; title: string; subtitle: string }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 inline-flex h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
