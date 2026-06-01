import { Check, Pencil } from "lucide-react";
import { vehicleMeta, styleMeta, stopMeta } from "@/lib/trips-store";
import { energyMeta, type Vehicle } from "@/lib/vehicles-store";

export interface VehicleCardProps {
  vehicle: Vehicle;
  isDefault: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  extraContent?: React.ReactNode;
}

export function VehicleCard({ vehicle, isDefault, onEdit, onSetDefault, extraContent }: VehicleCardProps) {
  const tm = vehicleMeta(vehicle.type);
  const em = energyMeta(vehicle.energy);
  const sm = styleMeta(vehicle.defaultStyle);
  return (
    <div className={`rounded-2xl border-2 p-4 transition-colors ${isDefault ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 rounded-xl border border-border bg-surface-2 overflow-hidden grid place-items-center text-2xl shrink-0">
          {vehicle.photo ? <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" /> : <span>{tm.emoji}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-display text-lg uppercase leading-tight">{vehicle.name}</p>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                <Check className="h-3 w-3" /> Standard
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{tm.emoji} {tm.label} · {em.emoji} {em.label}</p>
          <p className="mt-1.5 text-[11px] text-primary uppercase tracking-wider">{sm.emoji} {sm.label}</p>
          {vehicle.stopInterests.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground truncate">
              {vehicle.stopInterests.slice(0, 6).map((t) => stopMeta(t).emoji).join(" ")}
            </p>
          )}
        </div>
        <button onClick={onEdit} className="text-muted-foreground hover:text-primary p-1.5" aria-label="Rediger">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {!isDefault && (
        <button onClick={onSetDefault} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
          Sett som standard
        </button>
      )}
      {extraContent}
    </div>
  );
}
