import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Printer, Loader2 } from "lucide-react";
import { listMyInvoicesFn } from "@/lib/partner.functions";

export const Route = createFileRoute("/partner/dashboard/invoices")({
  component: PartnerInvoices,
});

function PartnerInvoices() {
  const fetcher = useServerFn(listMyInvoicesFn);
  const { data, isLoading } = useQuery({
    queryKey: ["partner-invoices"],
    queryFn: () => fetcher(),
  });

  return (
    <section className="mx-auto max-w-5xl px-4 md:px-8 py-10 md:py-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Økonomi</p>
      <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Fakturaer</h1>

      {isLoading ? (
        <div className="mt-8 grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data?.invoices.length ? (
        <p className="mt-8 text-sm text-[#1a1a1a]/60">
          Ingen fakturaer enda. Genereres automatisk den 1. i hver måned.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-black/5 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-[#1a1a1a]/50 border-b border-black/5">
              <tr>
                <th className="px-5 py-3">Periode</th>
                <th className="px-5 py-3">Visninger</th>
                <th className="px-5 py-3">Klikk</th>
                <th className="px-5 py-3">Beløp</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-5 py-4">{inv.period_start} – {inv.period_end}</td>
                  <td className="px-5 py-4">{inv.impressions.toLocaleString("nb-NO")}</td>
                  <td className="px-5 py-4">{inv.clicks.toLocaleString("nb-NO")}</td>
                  <td className="px-5 py-4 font-semibold">{inv.amount_nok.toLocaleString("nb-NO")} kr</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {inv.status === "paid" ? "Betalt" : "Ubetalt"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 text-xs text-[#1a1a1a]/65 hover:text-[#1a1a1a]"
                    >
                      <Printer className="h-3.5 w-3.5" /> Last ned PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
