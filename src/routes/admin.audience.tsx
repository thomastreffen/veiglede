import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { getAudienceStatsFn } from "@/lib/benefits.functions";

export const Route = createFileRoute("/admin/audience")({
  component: AudiencePage,
});

const VEHICLE_LABEL: Record<string, string> = { motorcycle: "MC", car: "Bil", rv: "Bobil" };
const ENERGY_LABEL: Record<string, string> = { petrol: "Bensin", diesel: "Diesel", electric: "Elektrisk", hybrid: "Hybrid" };

function AudiencePage() {
  const fn = useServerFn(getAudienceStatsFn);
  const { data, isLoading } = useQuery({ queryKey: ["audience-stats-admin"], queryFn: () => fn() });
  if (isLoading) return <div className="py-20 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return null;

  const vehicleData = Object.entries(data.byVehicleType).map(([k, v]) => ({ name: VEHICLE_LABEL[k] ?? k, value: v }));
  const energyData = Object.entries(data.byEnergyType).map(([k, v]) => ({ name: ENERGY_LABEL[k] ?? k, value: v }));
  const regionData = Object.entries(data.byRegion).map(([k, v]) => ({ name: k, value: v })).slice(0, 8);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Målgruppe</p>
        <h1 className="mt-1 font-display text-3xl uppercase">Anonymisert statistikk</h1>
        <p className="mt-2 text-sm text-slate-400">Statistikk basert på {data.totalOptedIn.toLocaleString("nb-NO")} brukere som har samtykket til anonym databruk.</p>
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Samtykkende brukere" value={data.totalOptedIn.toLocaleString("nb-NO")} />
        <Stat label="Snitt turer per bruker" value={String(data.avgTripsPerUser)} />
        <Stat label="Snitt km per bruker" value={`${data.avgKmPerUser.toLocaleString("nb-NO")} km`} />
      </div>

      <Chart title="Kjøretøytyper" data={vehicleData} />
      <Chart title="Drivlinjer" data={energyData} />
      <Chart title="Topp regioner" data={regionData} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl">{value}</p>
    </div>
  );
}

function Chart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="font-display text-base uppercase mb-3">{title}</h2>
      {data.length === 0 ? <p className="text-sm text-slate-500">Ingen data enda.</p> : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
