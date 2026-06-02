import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { helpBotInsightsFn } from "@/lib/helpbot-admin.functions";

export const Route = createFileRoute("/admin/help")({
  head: () => ({ meta: [{ title: "Hjelp — Admin · Veiglede" }, { name: "robots", content: "noindex" }] }),
  component: AdminHelpPage,
});

function AdminHelpPage() {
  const fetchInsights = useServerFn(helpBotInsightsFn);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-help-insights"],
    queryFn: () => fetchInsights(),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="p-6 text-sm text-slate-400">Laster…</p>;
  if (error || !data) return <p className="p-6 text-sm text-red-400">Klarte ikke å hente innsikt.</p>;

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Hjelp</p>
        <h1 className="text-2xl font-bold text-slate-100 mt-1">Hjelpe-bot innsikt</h1>
        <p className="text-sm text-slate-400 mt-1">Oversikt over hva brukerne spør om, og hvor boten kommer til kort.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tilbakemeldinger" value={data.total} />
        <Stat label="Markert nyttig" value={data.helpful} />
        <Stat label="Tilfredshet" value={`${data.satisfaction}%`} />
        <Stat label="Uten svar" value={data.unanswered.length} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Mest spurte stikkord</h2>
        {data.topKeywords.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen data ennå.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.topKeywords.map((k) => (
              <span key={k.keyword} className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-200">
                {k.keyword} <span className="text-slate-500">· {k.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Ubesvarte spørsmål</h2>
        {data.unanswered.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen ubesvarte spørsmål.</p>
        ) : (
          <ul className="space-y-2">
            {data.unanswered.map((u, i) => (
              <li key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
                {u.question}
                <span className="ml-2 text-[10px] text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Ikke til hjelp 👎</h2>
        {data.unhelpful.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen negative tilbakemeldinger.</p>
        ) : (
          <ul className="space-y-3">
            {data.unhelpful.map((u, i) => (
              <li key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-sm font-medium text-slate-100">{u.question}</p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-3">{u.answer}</p>
                {u.feedback && (
                  <p className="mt-2 text-xs text-amber-300/90">Bruker: {u.feedback}</p>
                )}
                <p className="mt-1 text-[10px] text-slate-500">{new Date(u.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
    </div>
  );
}
