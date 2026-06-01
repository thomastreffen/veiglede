import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pause, Play, FileText, Loader2 } from "lucide-react";
import { getMyDashboardFn, setCampaignStatusFn } from "@/lib/partner.functions";

export const Route = createFileRoute("/partner/dashboard/")({
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const fetcher = useServerFn(getMyDashboardFn);
  const setStatus = useServerFn(setCampaignStatusFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["partner-dashboard"],
    queryFn: () => fetcher(),
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      setStatus({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-dashboard"] }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 md:px-8 py-16 grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.account) {
    return (
      <div className="mx-auto max-w-2xl px-4 md:px-8 py-16 text-center">
        <h1 className="font-display text-2xl uppercase">Ingen partnerkonto</h1>
        <p className="mt-3 text-[#1a1a1a]/65">Du må registrere bedriften din først.</p>
        <Link
          to="/partner/register"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground"
        >
          Registrer bedrift
        </Link>
      </div>
    );
  }

  const stats = data.stats!;
  const pending = data.account.status === "pending";

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-10 md:py-12 space-y-8">
      {pending && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Søknaden er under behandling. Du kan opprette kampanjer som utkast, men de vises ikke før kontoen er godkjent.
        </div>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Denne måneden</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Oversikt</h1>
        </div>
        <Link
          to="/partner/dashboard/campaign/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={3} /> Ny kampanje
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Visninger" value={stats.impressions.toLocaleString("nb-NO")} />
        <Stat label="Klikk" value={stats.clicks.toLocaleString("nb-NO")} />
        <Stat label="CTR" value={`${stats.ctr}%`} />
        <Stat label="Est. kostnad" value={`${stats.estimatedCost.toLocaleString("nb-NO")} kr`} />
      </div>

      <div>
        <h2 className="font-display text-xl uppercase tracking-wide">Kampanjer</h2>
        {data.campaigns.length === 0 ? (
          <p className="mt-4 text-sm text-[#1a1a1a]/60">Du har ingen kampanjer enda.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-black/5 bg-white p-5 flex items-center justify-between gap-4 flex-wrap"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base uppercase tracking-wide">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-xs text-[#1a1a1a]/55">
                    {c.starts_at} → {c.ends_at} · {c.budget_nok.toLocaleString("nb-NO")} kr ·{" "}
                    {c.pricing_model === "cpm" ? `${c.cpm_rate} kr CPM` : "Fast pris"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.status === "active" && (
                    <button
                      type="button"
                      onClick={() => toggle.mutate({ id: c.id, status: "paused" })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-black/10 hover:bg-black/5"
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  )}
                  {(c.status === "paused" || c.status === "draft") && (
                    <button
                      type="button"
                      onClick={() => toggle.mutate({ id: c.id, status: "active" })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-primary text-primary hover:bg-primary/5"
                    >
                      <Play className="h-3.5 w-3.5" /> Aktiver
                    </button>
                  )}
                  <Link
                    to="/partner/dashboard/campaign/$id"
                    params={{ id: c.id }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs hover:bg-black/5"
                  >
                    Rediger
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-wrap">
        <Link
          to="/partner/dashboard/invoices"
          className="inline-flex items-center gap-2 text-sm text-[#1a1a1a]/65 hover:text-[#1a1a1a]"
        >
          <FileText className="h-4 w-4" /> Se fakturaer
        </Link>
        <Link
          to="/partner/dashboard/benefits"
          className="inline-flex items-center gap-2 text-sm text-[#1a1a1a]/65 hover:text-[#1a1a1a]"
        >
          🎁 Fordeler
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#1a1a1a]/50">{label}</p>
      <p className="mt-2 font-display text-2xl">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-black/5 text-[#1a1a1a]/65",
    active: "bg-green-100 text-green-800",
    paused: "bg-amber-100 text-amber-800",
    completed: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
