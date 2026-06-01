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

export const Route = createFileRoute("/_app/garage")({
  head: () => ({ meta: [{ title: "Min garasje — Veiglede" }] }),
  component: GaragePage,
});

function GaragePage() {
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
      toast.error("Sett brukernavn i Profil først");
      return;
    }
    const url = `https://veiglede.no/u/${username}`;
    try { await navigator.clipboard.writeText(url); toast.success("Profillenke kopiert! 🔗"); }
    catch { toast.error("Kunne ikke kopiere"); }
  };

  const shareVehicle = async (vehicleId: string) => {
    if (!username) {
      toast.error("Sett brukernavn i Profil først");
      return;
    }
    const url = `https://veiglede.no/u/${username}#${vehicleId}`;
    try { await navigator.clipboard.writeText(url); toast.success("Kjøretøy-lenke kopiert! 🔗"); }
    catch { toast.error("Kunne ikke kopiere"); }
  };

  return (
    <div className="py-5 md:py-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Dine kjøretøy og statistikk</p>
          <h1 className="mt-1 font-display text-3xl md:text-5xl uppercase">Min garasje</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={copyProfileLink}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary"
            >
              <Share2 className="h-4 w-4" /> Del profilen min
            </button>
          )}
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> Legg til kjøretøy
          </button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((vh) => {
            const vehicleTrips = trips.filter(
              (t) =>
                t.status !== "draft" &&
                (t.vehicleId === vh.id || (!t.vehicleId && t.vehicle === vh.type))
            );
            const totalKm = vehicleTrips.reduce((sum, t) => sum + t.distanceKm, 0);
            const actualKm = vehicleTrips.reduce(
              (sum, t) => sum + (typeof t.actualDistanceKm === "number" ? t.actualDistanceKm : 0),
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
                        <span className="text-muted-foreground">Planlagte turer</span>
                        <span className="font-medium">{vehicleTrips.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Planlagt totalt</span>
                        <span className="font-medium">{totalKm.toLocaleString("nb-NO")} km</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Faktisk kjørt</span>
                        <span className={actualKm > 0 ? "font-medium text-primary" : "text-muted-foreground"}>
                          {actualKm > 0 ? `${Math.round(actualKm).toLocaleString("nb-NO")} km` : "0 km"}
                        </span>
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

      <VehicleEditor open={editorOpen} onOpenChange={setEditorOpen} vehicle={editing} />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
      <div className="mx-auto grid place-items-center h-16 w-16 rounded-2xl bg-surface-2 text-3xl mb-4">
        <Car className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-display text-2xl uppercase">Ingen kjøretøy enda</p>
      <p className="mt-2 text-sm text-muted-foreground">Legg til ditt første kjøretøy for å se statistikk og få ruter tilpasset deg.</p>
      <button
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> Legg til ditt første kjøretøy
      </button>
    </div>
  );
}
