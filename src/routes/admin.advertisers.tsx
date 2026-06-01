import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/advertisers")({
  component: () => (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Inntekt</p>
      <h1 className="font-display text-3xl md:text-4xl uppercase">Annonsører</h1>
      <p className="text-sm text-slate-400">Kommer snart — administrasjon av betalte plasseringer og kampanjer.</p>
    </div>
  ),
});
