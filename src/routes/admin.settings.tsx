import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.28em] text-primary">System</p>
      <h1 className="font-display text-3xl md:text-4xl uppercase">Innstillinger</h1>
      <p className="text-sm text-slate-400">Kommer snart — systembrede admininnstillinger.</p>
    </div>
  ),
});
