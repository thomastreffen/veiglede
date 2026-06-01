import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminDashboardStatsFn } from "@/lib/admin.functions";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchStats = useServerFn(adminDashboardStatsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Oversikt</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Dashboard</h1>
      </header>

      {isLoading || !data ? (
        <p className="text-sm text-slate-400">Laster…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Totalt antall brukere" value={data.usersTotal} />
            <StatCard label="Nye brukere · 7 dager" value={data.usersNew7d} accent />
            <StatCard label="Offentlige turer" value={data.publicTrips} />
            <StatCard label="Totalt km planlagt" value={data.totalKm.toLocaleString("nb-NO")} />
            <StatCard label="Aktive turer · 30 dager" value={data.activeTrips30d} />
            <StatCard label="Mest aktive region" value={data.topRegion} small />
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg uppercase">Nye brukere · siste 14 dager</h2>
              <span className="text-xs text-slate-500">{data.signups.reduce((a, d) => a + d.count, 0)} totalt</span>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.signups}>
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, small }: { label: string; value: number | string; accent?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-primary/40 bg-primary/10" : "border-slate-800 bg-slate-900/60"}`}>
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className={`mt-2 font-display ${small ? "text-xl" : "text-3xl md:text-4xl"} ${accent ? "text-primary" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
