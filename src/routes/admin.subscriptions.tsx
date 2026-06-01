import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminSubscriptionStatsFn, adminSetUserPlanFn } from "@/lib/subscription.functions";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Abonnementer — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminSubscriptions,
});

function AdminSubscriptions() {
  const qc = useQueryClient();
  const fetchStats = useServerFn(adminSubscriptionStatsFn);
  const setPlan = useServerFn(adminSetUserPlanFn);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: () => fetchStats(),
    staleTime: 15_000,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const update = async (userId: string, plan: "free" | "pro" | "gruppe") => {
    setBusyId(userId);
    try {
      await setPlan({ data: { userId, plan } });
      toast.success("Plan oppdatert");
      await qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Klarte ikke oppdatere");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Inntekter</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Abonnementer</h1>
      </header>

      {isLoading || !data ? (
        <p className="text-sm text-slate-400">Laster…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Gratis" value={data.counts.free} />
            <Card label="Pro" value={data.counts.pro} accent />
            <Card label="Gruppe" value={data.counts.gruppe} accent />
            <Card label="MRR (estimert)" value={`${data.mrr.toLocaleString("nb-NO")} kr`} accent />
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="p-5 border-b border-slate-800 flex items-baseline justify-between">
              <h2 className="font-display text-lg uppercase">Betalende abonnenter</h2>
              <span className="text-xs text-slate-500">{data.subscribers.length} totalt</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="text-left p-3">Bruker</th>
                    <th className="text-left p-3">Plan</th>
                    <th className="text-left p-3">Fornyes</th>
                    <th className="text-right p-3">Endre plan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscribers.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-500">Ingen betalende abonnenter enda.</td></tr>
                  )}
                  {data.subscribers.map((s) => (
                    <tr key={s.userId} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                      <td className="p-3">
                        <p className="font-medium">{s.displayName ?? "—"}</p>
                        <p className="text-xs text-slate-500">@{s.username ?? "—"}</p>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.plan === "gruppe" ? "bg-violet-500/20 text-violet-300" : "bg-primary/20 text-primary"}`}>
                          {s.plan}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-400">{s.renews ? new Date(s.renews).toLocaleDateString("nb-NO") : "—"}</td>
                      <td className="p-3 text-right">
                        <select
                          value={s.plan}
                          disabled={busyId === s.userId}
                          onChange={(e) => update(s.userId, e.target.value as "free" | "pro" | "gruppe")}
                          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-xs"
                        >
                          <option value="free">Gratis</option>
                          <option value="pro">Pro</option>
                          <option value="gruppe">Gruppe</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-primary/40 bg-primary/10" : "border-slate-800 bg-slate-900/60"}`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className={`mt-2 font-display text-3xl ${accent ? "text-primary" : "text-white"}`}>{value}</p>
    </div>
  );
}
