import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus, Car, Share2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useTripsStore, vehicleMeta, type VehicleType } from "@/lib/trips-store";
import { useVehicles, vehiclesApi, type Vehicle } from "@/lib/vehicles-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { VehicleEditor } from "@/components/VehicleEditor";
import { VehicleCard } from "@/components/VehicleCard";
import { VehiclePhotoStrip } from "@/components/VehiclePhotoStrip";
import { PublicUserCard } from "@/components/PublicUserCard";
import { fetchPublicProfilesFn } from "@/lib/public-profiles.functions";
import { useT } from "@/i18n/provider";

export const Route = createFileRoute("/_app/garage")({
  head: () => ({ meta: [{ title: "Min garasje — Veiglede" }] }),
  component: GaragePage,
});

function GaragePage() {
  const t = useT();
  const g = t.app.garage;
  const { vehicles, defaultId } = useVehicles();
  const { trips } = useTripsStore();
  const { user } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | undefined>(undefined);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setUsername(null); return; }
    let cancelled = false;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setUsername((data?.username as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  const openNew = () => { setEditing(undefined); setEditorOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setEditorOpen(true); };

  const copyProfileLink = async () => {
    if (!username) {
      toast.error(g.toastSetUsernameFirst);
      return;
    }
    const url = `https://veiglede.no/u/${username}`;
    try { await navigator.clipboard.writeText(url); toast.success(g.toastProfileLinkCopied); }
    catch { toast.error(g.toastCopyFailed); }
  };

  const shareVehicle = async (vehicleId: string) => {
    if (!username) {
      toast.error(g.toastSetUsernameFirst);
      return;
    }
    const url = `https://veiglede.no/u/${username}#${vehicleId}`;
    try { await navigator.clipboard.writeText(url); toast.success(g.toastVehicleLinkCopied); }
    catch { toast.error(g.toastCopyFailed); }
  };

  return (
    <div className="py-5 md:py-8 w-full">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{g.eyebrow}</p>
          <h1 className="mt-1 font-display text-3xl md:text-5xl uppercase">{g.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={copyProfileLink}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary"
            >
              <Share2 className="h-4 w-4" /> {g.shareProfile}
            </button>
          )}
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> {g.addVehicle}
          </button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState onAdd={openNew} g={g} />
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map((vh) => {
            const vehicleTrips = trips.filter(
              (tr) =>
                tr.status !== "draft" &&
                (tr.vehicleId === vh.id || (!tr.vehicleId && tr.vehicle === vh.type))
            );
            const totalKm = vehicleTrips.reduce((sum, tr) => sum + tr.distanceKm, 0);
            const completedTrips = vehicleTrips.filter(
              (tr) => typeof tr.actualDistanceKm === "number" && tr.actualDistanceKm > 0,
            );
            const actualKm = completedTrips.reduce(
              (sum, tr) => sum + (tr.actualDistanceKm ?? 0),
              0,
            );

            return (
              <VehicleCard
                key={vh.id}
                vehicle={vh}
                isDefault={vh.id === defaultId}
                onEdit={() => openEdit(vh)}
                onSetDefault={() => vehiclesApi.setDefault(vh.id)}
                extraContent={
                  <>
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{g.plannedTrips}</span>
                        <span className="font-medium">{vehicleTrips.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{g.plannedTotal}</span>
                        <span className="font-medium">
                          {totalKm.toLocaleString("nb-NO")} km
                          <span className="ml-1 text-[9px] uppercase tracking-wider text-muted-foreground">{g.plannedTag}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{g.actualDriven}</span>
                        {completedTrips.length > 0 ? (
                          <span className="font-medium text-primary">
                            {Math.round(actualKm).toLocaleString("nb-NO")} km
                            <span className="ml-1 text-[9px] uppercase tracking-wider text-primary">{g.drivenTag}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">{g.noCompletedTrips}</span>
                        )}
                      </div>
                    </div>
                    <VehiclePhotoStrip vehicleId={vh.id} onShare={() => shareVehicle(vh.id)} />
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {user && vehicles.length > 0 && (
        <SameVehicleSection
          ownUserId={user.id}
          types={Array.from(new Set(vehicles.map((v) => v.type)))}
          g={g}
        />
      )}

      <VehicleEditor open={editorOpen} onOpenChange={setEditorOpen} vehicle={editing} />
    </div>
  );
}

function SameVehicleSection({ ownUserId, types, g }: { ownUserId: string; types: VehicleType[]; g: { communityEyebrow: string; otherDrivers: (v: string) => string; seeAll: string } }) {
  const fetcher = useServerFn(fetchPublicProfilesFn);
  const { data } = useQuery({
    queryKey: ["public-profiles"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });
  const focusType = types[0];
  const matches = useMemo(() => {
    if (!data) return [];
    return data
      .filter((u) => u.id !== ownUserId && u.vehicleTypes.includes(focusType))
      .slice(0, 4);
  }, [data, ownUserId, focusType]);

  if (matches.length === 0) return null;
  const meta = vehicleMeta(focusType);
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{g.communityEyebrow}</p>
          <h2 className="mt-1 font-display text-2xl md:text-3xl uppercase">{g.otherDrivers(`${meta.emoji} ${meta.label.toLowerCase()}`)}</h2>
        </div>
        <Link
          to="/explore"
          search={{ tab: "brukere", vehicle: focusType }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {g.seeAll} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {matches.map((u) => <PublicUserCard key={u.id} user={u} />)}
      </ul>
    </section>
  );
}

function EmptyState({ onAdd, g }: { onAdd: () => void; g: { emptyTitle: string; emptyBody: string; emptyCta: string } }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <div className="mx-auto grid place-items-center h-16 w-16 rounded-2xl bg-surface-2 text-3xl mb-4">
        <Car className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-display text-2xl uppercase">{g.emptyTitle}</p>
      <p className="mt-2 text-sm text-muted-foreground">{g.emptyBody}</p>
      <button
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> {g.emptyCta}
      </button>
    </div>
  );
}
