import { Sparkles, ListChecks, ArrowRight } from "lucide-react";
import { useT } from "@/i18n/provider";

interface Props {
  onSelect: (mode: "ai" | "manual") => void;
}

export function ModeSelect({ onSelect }: Props) {
  const t = useT();
  const w = t.wizard.modeSelect;

  return (
    <div className="py-6 md:py-12 max-w-3xl mx-auto pb-32 md:pb-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-primary font-bold">{w.eyebrow}</p>
      <h1 className="mt-3 font-display text-4xl md:text-6xl uppercase leading-[0.95]">{w.title}</h1>
      <p className="mt-3 text-base text-muted-foreground">{w.subtitle}</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSelect("ai")}
          className="group text-left rounded-3xl border-2 border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 md:p-7 shadow-lg shadow-primary/10 hover:brightness-105 transition-all relative"
        >
          <span className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {w.ai.tag}
          </span>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-2xl md:text-3xl uppercase">{w.ai.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{w.ai.description}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-primary">
            {w.ai.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("manual")}
          className="group text-left rounded-3xl border-2 border-border bg-surface p-6 md:p-7 hover:border-primary/50 transition-all"
        >
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {w.manual.tag}
          </span>
          <div className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-foreground">
            <ListChecks className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-2xl md:text-3xl uppercase">{w.manual.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{w.manual.description}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-foreground">
            {w.manual.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">{w.footnote}</p>
    </div>
  );
}
