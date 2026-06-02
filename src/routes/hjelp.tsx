import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search } from "lucide-react";
import { HelpBot } from "@/components/HelpBot";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { useT } from "@/i18n/provider";

export const Route = createFileRoute("/hjelp")({
  head: () => ({
    meta: [
      { title: "Hjelp og svar — Veiglede" },
      {
        name: "description",
        content:
          "Finn svar på de vanligste spørsmålene om Veiglede — turplanlegging, GPS-eksport, deling, abonnement og personvern.",
      },
      { property: "og:title", content: "Hjelp og svar — Veiglede" },
      { property: "og:description", content: "Vanlige spørsmål om Veiglede roadtrip-planlegger." },
    ],
  }),
  component: HjelpPage,
});

function HjelpPage() {
  const t = useT();
  const hj = t.hjelp;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hj.sections;
    return hj.sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [query, hj.sections]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-5 flex items-center justify-between">
          <Link to="/" aria-label="Veiglede">
            <VeigledeLogo size="md" />
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {hj.back}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-6 py-10">
        <p className="text-xs uppercase tracking-[0.28em] text-primary font-semibold">{hj.eyebrow}</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{hj.title}</h1>
        <p className="mt-3 text-muted-foreground">{hj.subtitle}</p>

        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={hj.searchPlaceholder}
            className="w-full rounded-2xl border border-border bg-surface pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="mt-8 space-y-8">
          {filtered.length === 0 && (
            <p className="text-muted-foreground">{hj.noResults}</p>
          )}
          {filtered.map((section) => (
            <section key={section.title}>
              <h2 className="text-xs uppercase tracking-[0.24em] font-semibold text-muted-foreground mb-3">
                {section.title}
              </h2>
              <Accordion type="multiple" className="rounded-2xl border border-border bg-surface divide-y divide-border">
                {section.items.map((it, i) => (
                  <AccordionItem key={i} value={`${section.title}-${i}`} className="border-0 px-4">
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                      {it.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{it.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-surface-2/40 p-5 text-sm">
          <p className="font-semibold">{hj.cantFind}</p>
          <p className="mt-1 text-muted-foreground">
            {hj.emailUsPre}
            <a href="mailto:kontakt@veiglede.no" className="text-primary underline">
              kontakt@veiglede.no
            </a>
            {hj.emailUsPost}
          </p>
        </div>
      </main>

      <HelpBot />
    </div>
  );
}
