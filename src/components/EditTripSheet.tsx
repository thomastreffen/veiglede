import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { tripsApi, ROUTE_STYLES, type Trip, type RouteStyle, vehicleMeta } from "@/lib/trips-store";
import { useVehicles, energyTypeToSource } from "@/lib/vehicles-store";
import type { ResolvedPlace } from "@/lib/places/geocoder";
import { toast } from "sonner";
import { recalculateTripRoute } from "@/lib/trip-route-controller";

interface Props {
  trip: Trip;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EditTripSheet({ trip, open, onOpenChange }: Props) {
  const { vehicles } = useVehicles();

  const [title, setTitle] = useState(trip.title);
  const [subtitle, setSubtitle] = useState(trip.subtitle ?? "");
  const [region, setRegion] = useState(trip.region ?? "");
  const [origin, setOrigin] = useState(trip.origin);
  const [destination, setDestination] = useState(trip.destination);
  const [fromPlace, setFromPlace] = useState<ResolvedPlace | null>(null);
  const [toPlace, setToPlace] = useState<ResolvedPlace | null>(null);
  const [startDate, setStartDate] = useState(trip.startDate ?? "");
  const [endDate, setEndDate] = useState(trip.endDate ?? "");
  const [vehicleId, setVehicleId] = useState(trip.vehicleId ?? "");
  const [style, setStyle] = useState<RouteStyle>(trip.style);
  const [saving, setSaving] = useState(false);

  // Reset when sheet (re)opens or trip changes
  useEffect(() => {
    if (!open) return;
    setTitle(trip.title);
    setSubtitle(trip.subtitle ?? "");
    setRegion(trip.region ?? "");
    setOrigin(trip.origin);
    setDestination(trip.destination);
    setFromPlace(null);
    setToPlace(null);
    setStartDate(trip.startDate ?? "");
    setEndDate(trip.endDate ?? "");
    setVehicleId(trip.vehicleId ?? "");
    setStyle(trip.style);
  }, [open, trip]);

  const originChanged = origin.trim() !== trip.origin.trim() || !!fromPlace;
  const destChanged = destination.trim() !== trip.destination.trim() || !!toPlace;
  const routeWillChange = originChanged || destChanged;

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === vehicleId),
    [vehicles, vehicleId],
  );

  const handleSave = async () => {
    if (!title.trim() || !origin.trim() || !destination.trim()) {
      toast.error("Tittel, startsted og destinasjon må fylles ut.");
      return;
    }
    setSaving(true);

    const patch: Partial<Trip> = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      region: region.trim() || undefined,
      origin: origin.trim(),
      destination: destination.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      style,
    };

    if (selectedVehicle) {
      patch.vehicleId = selectedVehicle.id;
      patch.vehicle = selectedVehicle.type;
      patch.vehicleName = selectedVehicle.name;
      patch.energy = energyTypeToSource(selectedVehicle.energy);
    }

    if (fromPlace) patch.originLoc = { lat: fromPlace.lat, lng: fromPlace.lng };
    if (toPlace) patch.destinationLoc = { lat: toPlace.lat, lng: toPlace.lng };

    let recalc = false;
    if (routeWillChange) {
      recalc = typeof window !== "undefined"
        ? window.confirm("Startsted eller destinasjon er endret. Beregne ruta på nytt?")
        : true;
      if (recalc) {
        // Clearing the hash + cached geometry forces the map to refetch.
        patch.routeGeometry = undefined;
        patch.routeWaypointsHash = undefined;
        patch.routeDistanceKm = undefined;
        patch.routeDurationMin = undefined;
      }
    }

    try {
      tripsApi.updateTrip(trip.id, patch);
      toast.success(recalc ? "Tur oppdatert — ruta beregnes på nytt." : "Tur oppdatert.");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Kunne ikke lagre endringene.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl uppercase">Rediger tur</SheetTitle>
          <SheetDescription>Oppdater detaljene for denne turen.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Field label="Tittel">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Undertittel (valgfri)">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} />
          </Field>

          <Field label="Startsted">
            <PlaceAutocomplete
              value={origin}
              onTextChange={setOrigin}
              selected={fromPlace}
              onSelect={setFromPlace}
              ariaLabel="Startsted"
            />
          </Field>

          <Field label="Destinasjon">
            <PlaceAutocomplete
              value={destination}
              onTextChange={setDestination}
              selected={toPlace}
              onSelect={setToPlace}
              ariaLabel="Destinasjon"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Startdato">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Sluttdato (valgfri)">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Kjøretøy">
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputCls}>
              <option value="">— Velg kjøretøy —</option>
              {vehicles.map((v) => {
                const m = vehicleMeta(v.type);
                return (
                  <option key={v.id} value={v.id}>{m.emoji} {v.name} ({m.label})</option>
                );
              })}
            </select>
          </Field>

          <Field label="Rutestil">
            <select value={style} onChange={(e) => setStyle(e.target.value as RouteStyle)} className={inputCls}>
              {ROUTE_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Region (valgfri)">
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="f.eks. Vestlandet" className={inputCls} />
          </Field>

          {routeWillChange && (
            <p className="text-xs text-primary/90 leading-relaxed">
              Du har endret startsted eller destinasjon. Du blir spurt om å beregne ruta på nytt når du lagrer.
            </p>
          )}
        </div>

        <SheetFooter className="mt-6 flex-row gap-2 sm:justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:border-primary"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Lagrer…" : "Lagre"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const inputCls = "w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
