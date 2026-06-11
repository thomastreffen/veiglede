import { vehicleMeta, styleMeta, type VehicleType, type RouteStyle } from "@/lib/trips-store";

export interface VehicleIdentity {
  /** Free-form display name from the user's garage, when public. */
  name?: string;
  type: VehicleType;
  energy?: string;
  /** Short personal description from the garage, when public. */
  description?: string;
}

interface Props {
  vehicle: VehicleIdentity;
  style: RouteStyle;
}

/**
 * Compact "Kjørt med X · Style" card shown on public trip pages so the
 * vehicle is part of the story, not just metadata.
 */
export function VehicleIdentityCard({ vehicle, style }: Props) {
  const v = vehicleMeta(vehicle.type);
  const s = styleMeta(style);
  const name = vehicle.name?.trim() || v.label;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Kjøretøy & stil</p>
      <p className="mt-1 font-display text-lg uppercase leading-tight">
        <span className="text-primary">Kjørt med</span> {name}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">{v.emoji} {v.label}</span>
        {vehicle.energy && <span> · {vehicle.energy}</span>}
        <span> · {s.emoji} {s.label}</span>
      </p>
      {vehicle.description && (
        <p className="mt-2 text-xs text-foreground/80 italic leading-relaxed">"{vehicle.description}"</p>
      )}
    </section>
  );
}

/** Inline one-liner version used inside cards. */
export function VehicleIdentityLine({ vehicle }: { vehicle: VehicleIdentity }) {
  const v = vehicleMeta(vehicle.type);
  const name = vehicle.name?.trim() || v.label;
  return (
    <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
      <span>{v.emoji}</span>
      <span className="truncate">Kjørt med {name}</span>
    </p>
  );
}
