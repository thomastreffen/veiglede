import { Link } from "@tanstack/react-router";
import { MapPin, Route as RouteIcon, ArrowRight } from "lucide-react";
import { vehicleMeta, type VehicleType } from "@/lib/trips-store";
import type { PublicProfileSummary } from "@/lib/public-profiles.functions";

export function PublicUserCard({ user }: { user: PublicProfileSummary }) {
  const initial = (user.displayName || user.username || "?").charAt(0).toUpperCase();
  const types = user.vehicleTypes.slice(0, 3);
  return (
    <li>
      <Link
        to="/u/$username"
        params={{ username: user.username }}
        className="group block h-full rounded-2xl border border-border bg-surface p-4 md:p-5 hover:border-primary/60 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-xl overflow-hidden">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              : initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base uppercase truncate group-hover:text-primary transition-colors">
              {user.displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
          </div>
          {types.length > 0 && (
            <div className="flex items-center gap-0.5 text-base shrink-0" aria-label="Kjøretøy">
              {types.map((t) => (
                <span key={t} title={vehicleMeta(t as VehicleType).label}>
                  {vehicleMeta(t as VehicleType).emoji}
                </span>
              ))}
            </div>
          )}
        </div>

        {user.bio && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{user.bio}</p>
        )}

        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <RouteIcon className="h-3 w-3" /> {user.tripsCount} {user.tripsCount === 1 ? "tur" : "turer"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {user.totalKm.toLocaleString("nb-NO")} km
          </span>
          <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">
            Se profil <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </li>
  );
}
