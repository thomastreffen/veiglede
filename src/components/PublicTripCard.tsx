import { Link } from "@tanstack/react-router";
import { Route as RouteIcon, Clock, MapPin, ArrowRight, BookOpen, Camera, Flag, Bookmark, Flame } from "lucide-react";
import { COVERS, vehicleMeta, styleMeta, type CoverKey, type VehicleType, type RouteStyle } from "@/lib/trips-store";
import { getPublicPlaceLabel } from "@/lib/public-place";
import { AvatarImg } from "@/lib/avatar";
import { CopyTripButton } from "@/components/CopyTripButton";
import { VehicleIdentityLine, type VehicleIdentity } from "@/components/VehicleIdentityCard";

export interface PublicTripCardData {
  id: string;
  title: string;
  subtitle?: string;
  region?: string;
  origin: string;
  destination: string;
  distanceKm: number;
  drivingTime: string;
  stopsCount: number;
  cover: string;
  style: string;
  vehicle: string;
  shareToken: string;
}

interface Props {
  trip: PublicTripCardData;
  ownerName?: string;
  ownerAvatarUrl?: string;
  ownerUsername?: string;
  /** Optional resolved garage vehicle identity for the inline "Kjørt med …" line. */
  vehicleIdentity?: VehicleIdentity;
  /** Lightweight social stats for activity chips. */
  stats?: { drive: number; saves: number; reactions: number };
  /** Status label shown as a badge on the cover. */
  status?: "delt" | "offentlig" | "roadbook";
  /** Hide the "Kopier tur" action (e.g. when the viewer is the owner). */
  hideCopy?: boolean;
}

const STATUS_META: Record<NonNullable<Props["status"]>, { label: string; cls: string }> = {
  delt: { label: "Delt tur", cls: "border-primary/40 bg-primary/10 text-primary" },
  offentlig: { label: "Offentlig tur", cls: "border-accent/40 bg-accent/10 text-accent" },
  roadbook: { label: "Roadbook", cls: "border-border bg-background/60 text-foreground" },
};

export function PublicTripCard({
  trip,
  ownerName,
  ownerAvatarUrl,
  ownerUsername,
  vehicleIdentity,
  stats,
  status = "delt",
  hideCopy = false,
}: Props) {
  const v = vehicleMeta(trip.vehicle as VehicleType);
  const s = styleMeta(trip.style as RouteStyle);
  const cover = (trip.cover as CoverKey) ?? "fjord";
  const statusMeta = STATUS_META[status];
  const initial = (ownerName ?? "?").charAt(0).toUpperCase();

  return (
    <article className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/60 transition-colors">
      <Link
        to="/tur/delt/$shareToken"
        params={{ shareToken: trip.shareToken }}
        className="block"
      >
        <div className={`relative h-28 bg-gradient-to-br ${COVERS[cover]}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <span className={`absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full backdrop-blur px-2.5 py-0.5 text-[10px] uppercase tracking-wider border ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] border border-border">
            {v.emoji} {s.emoji}
          </span>
        </div>
      </Link>

      <div className="p-4">
        {/* Owner row */}
        {(ownerName || ownerAvatarUrl) && (
          <div className="flex items-center gap-2 mb-2">
            <span className="h-7 w-7 rounded-full bg-primary/15 grid place-items-center text-[11px] font-bold text-primary overflow-hidden shrink-0">
              {ownerAvatarUrl ? <AvatarImg value={ownerAvatarUrl} className="h-full w-full object-cover" /> : initial}
            </span>
            {ownerUsername ? (
              <Link
                to="/u/$username"
                params={{ username: ownerUsername }}
                className="text-xs text-muted-foreground hover:text-primary truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {ownerName ?? `@${ownerUsername}`}
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground truncate">{ownerName}</span>
            )}
          </div>
        )}

        <Link
          to="/tur/delt/$shareToken"
          params={{ shareToken: trip.shareToken }}
          className="block"
        >
          {trip.region && <p className="text-[10px] uppercase tracking-wider text-primary">{trip.region}</p>}
          <h3 className="mt-0.5 font-display text-lg uppercase leading-tight group-hover:text-primary">{trip.title}</h3>
          {trip.subtitle && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{trip.subtitle}</p>}

          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <MapPin className="h-3 w-3 shrink-0 text-primary" />
            {getPublicPlaceLabel(trip.origin, "Startområde")} → {getPublicPlaceLabel(trip.destination, "Målområde")}
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><RouteIcon className="h-3 w-3" /> {trip.distanceKm} km</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {trip.drivingTime}</span>
            <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> {trip.stopsCount} stopp</span>
          </div>
        </Link>

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <Link
            to="/tur/delt/$shareToken"
            params={{ shareToken: trip.shareToken }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
          >
            <BookOpen className="h-3.5 w-3.5" /> Se roadbook
            <ArrowRight className="h-3 w-3" />
          </Link>
          {!hideCopy && (
            <CopyTripButton
              shareToken={trip.shareToken}
              originalTripId={trip.id}
              inspiredByDisplayName={ownerName}
              variant="secondary"
              label="Kopier tur"
            />
          )}
        </div>
      </div>
    </article>
  );
}
