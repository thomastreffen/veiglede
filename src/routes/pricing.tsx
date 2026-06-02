import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, Users, ArrowLeft } from "lucide-react";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { HelpBot } from "@/components/HelpBot";
import { useT } from "@/i18n/provider";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Priser — Veiglede" },
      { name: "description", content: "Veiglede er gratis å bruke. Oppgrader til Pro for ubegrenset planlegging, live-deling, PDF og AI-pakkeliste. Gruppe-plan for klubber." },
      { property: "og:title", content: "Priser — Veiglede" },
      { property: "og:description", content: "Fra 0 kr. Oppgrader til Pro (79 kr/mnd) eller Gruppe (199 kr/mnd) for klubber og bobil-lag." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const t = useT();
  const pr = t.pricing;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-surface">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2">
            <VeigledeLogo size="sm" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {pr.back}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">{pr.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl md:text-6xl uppercase">{pr.title}</h1>
          <p className="mt-4 text-base text-muted-foreground">{pr.subtitle}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          <PlanCard
            name={pr.freeName}
            price={pr.freePrice}
            tag={pr.freeTag}
            features={pr.freeFeatures}
            ctaLabel={pr.freeCta}
            ctaTo="/signup"
          />
          <PlanCard
            name={pr.proName}
            price={pr.proPrice}
            interval={pr.perMonth}
            yearlyNote={pr.proYearly}
            tag={pr.proTag}
            highlighted
            icon={<Sparkles className="h-4 w-4" />}
            features={pr.proFeatures}
            ctaLabel={pr.proCta}
            ctaTo="/settings"
            ctaHash="abonnement"
          />
          <PlanCard
            name={pr.groupName}
            price={pr.groupPrice}
            interval={pr.perMonth}
            tag={pr.groupTag}
            icon={<Users className="h-4 w-4" />}
            features={pr.groupFeatures}
            ctaLabel={pr.groupCta}
            ctaTo="/settings"
            ctaHash="abonnement"
          />
        </div>

        <section className="mt-20 max-w-3xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl uppercase text-center">{pr.faqTitle}</h2>
          <div className="mt-8 space-y-4">
            {pr.faqs.map((f) => (
              <Faq key={f.q} q={f.q}>{f.a}</Faq>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 mt-20 py-8 text-center text-xs text-muted-foreground">
        {pr.footerNote}<Link to="/hjelp" className="hover:text-foreground underline">{pr.helpLink}</Link>
      </footer>
      <HelpBot />
    </div>
  );
}

function PlanCard({
  name, price, interval, yearlyNote, tag, features, ctaLabel, ctaTo, ctaHash, highlighted, icon,
}: {
  name: string;
  price: string;
  interval?: string;
  yearlyNote?: string;
  tag?: string;
  features: readonly string[];
  ctaLabel: string;
  ctaTo: string;
  ctaHash?: string;
  highlighted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-3xl border p-6 md:p-7 flex flex-col ${
        highlighted
          ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-xl shadow-primary/10 md:-translate-y-2"
          : "border-border bg-surface"
      }`}
    >
      {tag && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            highlighted ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground border border-border"
          }`}
        >
          {icon}
          {tag}
        </span>
      )}
      <div className="mt-2">
        <p className="font-display text-2xl uppercase">{name}</p>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-display text-4xl md:text-5xl">{price}</span>
          {interval && <span className="text-sm text-muted-foreground">{interval}</span>}
        </div>
        {yearlyNote && <p className="mt-1 text-xs text-primary">{yearlyNote}</p>}
      </div>
      <ul className="mt-6 space-y-2.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${highlighted ? "text-primary" : "text-muted-foreground"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to={ctaTo}
        hash={ctaHash}
        className={`mt-7 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition ${
          highlighted
            ? "bg-primary text-primary-foreground hover:brightness-110"
            : "border border-border hover:border-primary hover:text-primary"
        }`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border bg-surface p-5">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-semibold">
        {q}
        <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{children}</p>
    </details>
  );
}
