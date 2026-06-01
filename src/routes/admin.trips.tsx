import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminListTripsFn, adminSetTripPublicFn, adminDeleteTripFn } from "@/lib/admin.functions";
import { EyeOff, Eye, Trash2, Heart } from "lucide-react";

export const Route = createFileRoute("/admin/trips")({
  component: AdminTrips,
});

type Filter = "all" | "public" | "hidden";

function AdminTrips() {
  const list = useServerFn(adminListTripsFn);
  const setPublic = useServerFn(adminSetTripPublicFn);
  const del = useServerFn(adminDeleteTripFn);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-trips", filter],
    queryFn: () => list({ data: { filter } }),
    staleTime: 15_000,
  });

  const onHide = async (ownerId: string, tripId: string, makePublic: boolean) => {
    try {
      await setPublic({ data: { ownerId, tripId, isPublic: makePublic } });
      toast.success(makePublic ? "Turen er synlig igjen" : "Turen er skjult fra Utforsk");
      qc.invalidateQueries({ queryKey: ["admin-trips"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  const onDelete = async (ownerId: string, tripId: string, title: string) => {
    if (!confirm(`Slette "${title}" permanent?`)) return;
    try {
      await del({ data: { ownerId, tripId } });
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["admin-trips"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  const trips = data?.trips ?? [];

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Innhold</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Turer</h1>
        </div>
        <p className="text-xs text-slate-400">{trips.length} turer</p>
      </header>

      <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900/60 p-1 text-xs">
        {(["all", "public", "hidden"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${filter === f ? "bg-primary text-primary-foreground font-semibold" : "text-slate-400 hover:text-white"}`}
          >
            {f === "all" ? "Alle" : f === "public" ? "Offentlige" : "Skjulte"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <th className="text-left px-4 py-3">Tittel</th>
              <th className="text-left px-4 py-3">Rute</th>
              <th className="text-left px-4 py-3">Eier</th>
              <th className="text-left px-4 py-3">Km</th>
              <th className="text-left px-4 py-3">Reaksjoner</th>
              <th className="text-left px-4 py-3">Opprettet</th>
              <th className="text-right px-4 py-3">Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Laster…</td></tr>
            ) : trips.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Ingen turer</td></tr>
            ) : trips.map((t) => (
              <tr key={`${t.ownerId}:${t.id}`} className={`border-b border-slate-800/60 ${!t.isPublic ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  {t.title}
                  {!t.isPublic && <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">skjult</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{t.origin} → {t.destination}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{t.ownerUsername ? `@${t.ownerUsername}` : t.ownerName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{t.distanceKm}</td>
                <td className="px-4 py-3 text-slate-300">
                  <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{t.reactions}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{t.createdAt ? new Date(t.createdAt).toLocaleDateString("nb-NO") : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1.5">
                    {t.isPublic ? (
                      <button onClick={() => onHide(t.ownerId, t.id, false)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800">
                        <EyeOff className="h-3 w-3" /> Skjul
                      </button>
                    ) : (
                      <button onClick={() => onHide(t.ownerId, t.id, true)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800">
                        <Eye className="h-3 w-3" /> Vis
                      </button>
                    )}
                    <button onClick={() => onDelete(t.ownerId, t.id, t.title)} className="inline-flex items-center gap-1 rounded-lg border border-red-800 text-red-400 px-2 py-1 text-[11px] hover:bg-red-900/20">
                      <Trash2 className="h-3 w-3" /> Slett
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
