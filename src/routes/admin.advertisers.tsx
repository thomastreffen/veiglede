import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pause, Loader2 } from "lucide-react";
import { listPartnerAccountsFn, setPartnerAccountStatusFn } from "@/lib/partner.functions";

export const Route = createFileRoute("/admin/advertisers")({
  component: AdminAdvertisers,
});

function AdminAdvertisers() {
  const fetcher = useServerFn(listPartnerAccountsFn);
  const setStatus = useServerFn(setPartnerAccountStatusFn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-partner-accounts"],
    queryFn: () => fetcher(),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) =>
      setStatus({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partner-accounts"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Inntekt</p>
        <h1 className="font-display text-3xl md:text-4xl uppercase">Annonsører</h1>
        <p className="mt-2 text-sm text-slate-400">Godkjenn eller suspender partnerkontoer.</p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.accounts.length ? (
        <p className="text-sm text-slate-400">Ingen partnerkontoer enda.</p>
      ) : (
        <div className="space-y-3">
          {data.accounts.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-white/10 bg-slate-900/50 p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base uppercase tracking-wide">{a.business_name}</h3>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {a.contact_name} · {a.category}
                  {a.org_number ? ` · Org ${a.org_number}` : ""}
                </p>
                {a.website && (
                  <a href={a.website} target="_blank" rel="noopener" className="text-xs text-primary hover:underline">
                    {a.website}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                {a.status !== "active" && (
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: a.id, status: "active" })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-primary text-primary-foreground font-semibold hover:brightness-110"
                  >
                    <Check className="h-3.5 w-3.5" /> Godkjenn
                  </button>
                )}
                {a.status !== "suspended" && (
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: a.id, status: "suspended" })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-white/15 hover:bg-white/5"
                  >
                    <Pause className="h-3.5 w-3.5" /> Suspender
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300",
    active: "bg-green-500/20 text-green-300",
    suspended: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
