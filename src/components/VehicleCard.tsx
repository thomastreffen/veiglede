import { Check, Pencil, Eye, EyeOff } from "lucide-react";
import { vehicleMeta, styleMeta, stopMeta } from "@/lib/trips-store";
import { energyMeta, vehiclesApi, type Vehicle } from "@/lib/vehicles-store";

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
  const isPublic = vehicle.isPublic !== false;
  return (
    <div className={`rounded-2xl border-2 p-4 transition-colors ${isDefault ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 rounded-xl border border-border bg-surface-2 overflow-hidden grid place-items-center text-2xl shrink-0">
          {vehicle.photo ? <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" /> : <span>{tm.emoji}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-display text-lg uppercase leading-tight truncate">{vehicle.name}</p>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                <Check className="h-3 w-3" /> Standard
              </span>
            )}
          </div>
          {vehicle.nickname && (
            <p className="mt-0.5 text-sm italic text-primary/90 truncate">"{vehicle.nickname}"</p>
          )}
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
      {vehicle.description && (
        <p className="mt-3 text-xs leading-relaxed text-foreground/80 italic border-l-2 border-primary/40 pl-3">
          {vehicle.description}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        {!isDefault ? (
          <button onClick={onSetDefault} className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
            Sett som standard
          </button>
        ) : <span />}
        <button
          onClick={() => vehiclesApi.update(vehicle.id, { isPublic: !isPublic })}
          title={isPublic ? "Vis på offentlig profil" : "Skjult fra offentlig profil"}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            isPublic
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          {isPublic ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {isPublic ? "Vis på profil" : "Skjult"}
        </button>
      </div>
      {extraContent}
    </div>
  );
}
