import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Printer, Loader2, CreditCard, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { listMyInvoicesFn } from "@/lib/partner.functions";
import { createPartnerInvoiceCheckoutFn } from "@/lib/stripe.functions";

const searchSchema = z.object({
  paid: z.string().optional(),
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/partner/dashboard/invoices")({
  validateSearch: searchSchema,
  component: PartnerInvoices,
});

function PartnerInvoices() {
  const fetcher = useServerFn(listMyInvoicesFn);
  const checkout = useServerFn(createPartnerInvoiceCheckoutFn);
  const search = useSearch({ from: "/partner/dashboard/invoices" });
  const [payingId, setPayingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["partner-invoices"],
    queryFn: () => fetcher(),
  });

  useEffect(() => {
    if (search.paid === "true") {
      toast.success("Takk! Betalingen er registrert.", {
        description: "Det kan ta noen sekunder før status oppdateres.",
      });
      // Refetch a couple of times in case webhook hasn't landed yet
      const t1 = setTimeout(() => refetch(), 1500);
      const t2 = setTimeout(() => refetch(), 5000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [search.paid, refetch]);

  const pay = useMutation({
    mutationFn: (invoiceId: string) =>
      checkout({ data: { invoiceId, origin: window.location.origin } }),
    onMutate: (id) => setPayingId(id),
    onSettled: () => setPayingId(null),
    onSuccess: (res) => {
      if (res.ok && res.url) {
        window.location.href = res.url;
      } else {
        toast.error(res.ok ? "Mangler betalingslenke" : res.error);
      }
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Kunne ikke starte betaling"),
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
              {data.invoices.map((inv) => {
                const isPaid = inv.status === "paid";
                return (
                  <tr key={inv.id}>
                    <td className="px-5 py-4 whitespace-nowrap">{inv.period_start} – {inv.period_end}</td>
                    <td className="px-5 py-4">{inv.impressions.toLocaleString("nb-NO")}</td>
                    <td className="px-5 py-4">{inv.clicks.toLocaleString("nb-NO")}</td>
                    <td className="px-5 py-4 font-semibold whitespace-nowrap">{inv.amount_nok.toLocaleString("nb-NO")} kr</td>
                    <td className="px-5 py-4">
                      {isPaid ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-800 w-fit">
                            <CheckCircle2 className="h-3 w-3" /> Betalt
                          </span>
                          {inv.paid_at && (
                            <span className="text-[10px] text-[#1a1a1a]/50">
                              {new Date(inv.paid_at).toLocaleDateString("nb-NO")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          Ubetalt
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {isPaid ? (
                        inv.stripe_receipt_url ? (
                          <a
                            href={inv.stripe_receipt_url}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 text-xs text-[#1a1a1a]/65 hover:text-[#1a1a1a]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Last ned kvittering
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1.5 text-xs text-[#1a1a1a]/65 hover:text-[#1a1a1a]"
                          >
                            <Printer className="h-3.5 w-3.5" /> Last ned PDF
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled={payingId === inv.id}
                          onClick={() => pay.mutate(inv.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
                        >
                          {payingId === inv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CreditCard className="h-3.5 w-3.5" />
                          )}
                          Betal nå →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
