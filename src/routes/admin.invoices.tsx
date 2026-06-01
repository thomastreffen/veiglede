import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { listAllInvoicesAdminFn, markInvoicePaidManuallyFn } from "@/lib/stripe.functions";

export const Route = createFileRoute("/admin/invoices")({
  component: AdminInvoices,
});

type Filter = "all" | "unpaid" | "paid";

function AdminInvoices() {
  const fetcher = useServerFn(listAllInvoicesAdminFn);
  const markPaid = useServerFn(markInvoicePaidManuallyFn);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-invoices"],
    queryFn: () => fetcher(),
  });

  const mark = useMutation({
    mutationFn: (invoiceId: string) => markPaid({ data: { invoiceId } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Markert som betalt");
        qc.invalidateQueries({ queryKey: ["admin-all-invoices"] });
      } else {
        toast.error(res.error ?? "Feilet");
      }
    },
  });

  const invoices = data?.invoices ?? [];
  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter((i) => i.status === filter);
  }, [invoices, filter]);

  const outstanding = useMemo(
    () => invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.amount_nok, 0),
    [invoices],
  );

  const chartData = useMemo(() => buildMonthlyRevenue(invoices), [invoices]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Økonomi</p>
        <h1 className="font-display text-3xl md:text-4xl uppercase">Fakturaoversikt</h1>
        <p className="mt-2 text-sm text-slate-400">Alle partnerfakturaer på tvers av kontoer.</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Totalt" value={invoices.length.toString()} />
        <Stat label="Utestående" value={`${outstanding.toLocaleString("nb-NO")} kr`} accent />
        <Stat label="Betalt" value={`${invoices.filter((i) => i.status === "paid").length}`} />
        <Stat label="Ubetalt" value={`${invoices.filter((i) => i.status === "unpaid").length}`} />
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
        <h2 className="text-xs uppercase tracking-wider text-slate-400 mb-4">Månedsomsetning (betalt)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
                labelStyle={{ color: "#cbd5e1" }}
                formatter={(v: number) => [`${v.toLocaleString("nb-NO")} kr`, "Omsetning"]}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["all", "unpaid", "paid"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-white/15 text-slate-300 hover:bg-white/5"
            }`}
          >
            {f === "all" ? "Alle" : f === "unpaid" ? "Ubetalt" : "Betalt"}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !filtered.length ? (
        <p className="text-sm text-slate-400">Ingen fakturaer.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/50">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3">Beløp</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Betalt</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-medium">{inv.business_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400">{inv.period_start} – {inv.period_end}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{inv.amount_nok.toLocaleString("nb-NO")} kr</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        inv.status === "paid"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {inv.status === "paid" ? "Betalt" : "Ubetalt"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("nb-NO") : "—"}
                    {inv.paid_method && <span className="ml-1 text-slate-500">({inv.paid_method})</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {inv.status === "unpaid" ? (
                      <button
                        type="button"
                        onClick={() => mark.mutate(inv.id)}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/5"
                      >
                        <Check className="h-3.5 w-3.5" /> Merk betalt
                      </button>
                    ) : inv.stripe_receipt_url ? (
                      <a
                        href={inv.stripe_receipt_url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Kvittering
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-white/10 bg-slate-900/50"}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function buildMonthlyRevenue(
  invoices: Array<{ status: string; amount_nok: number; period_start: string }>,
): Array<{ month: string; amount: number }> {
  const buckets = new Map<string, number>();
  // Seed last 12 months for a stable axis
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }
  for (const inv of invoices) {
    if (inv.status !== "paid") continue;
    const d = new Date(inv.period_start);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + inv.amount_nok);
  }
  const monthLabels = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];
  return Array.from(buckets.entries()).map(([key, amount]) => {
    const [, m] = key.split("-");
    return { month: monthLabels[Number(m) - 1], amount };
  });
}
