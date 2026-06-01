import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toggleSaveTripFn, listSavedTripIdsFn } from "@/lib/social.functions";
import { tripsApi, type VehicleType, type RouteStyle, type CoverKey } from "@/lib/trips-store";

interface TripPayload {
  sourceTripId: string;
  title: string;
  subtitle?: string;
  region?: string;
  origin: string;
  destination: string;
  distanceKm: number;
  drivingTime: string;
  cover: string;
  style: string;
  vehicle: string;
}

interface Props {
  payload: TripPayload;
  className?: string;
  variant?: "pill" | "button";
}

// Module-level cache of saved IDs so multiple cards stay in sync without N requests.
let cachedSavedIds: Set<string> | null = null;
const listeners = new Set<() => void>();
function notify() { for (const l of listeners) l(); }

export function SaveTripButton({ payload, className = "", variant = "pill" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const list = useServerFn(listSavedTripIdsFn);
  const toggle = useServerFn(toggleSaveTripFn);

  const [saved, setSaved] = useState(() => cachedSavedIds?.has(payload.sourceTripId) ?? false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const refresh = () => setSaved(cachedSavedIds?.has(payload.sourceTripId) ?? false);
    listeners.add(refresh);
    if (!user) { setSaved(false); return () => { listeners.delete(refresh); }; }
    if (!cachedSavedIds) {
      list().then((ids) => {
        cachedSavedIds = new Set(ids);
        notify();
      }).catch(() => { cachedSavedIds = new Set(); });
    } else {
      refresh();
    }
    return () => { listeners.delete(refresh); };
  }, [user, payload.sourceTripId, list]);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate({ to: "/signup" });
      return;
    }
    if (pending) return;
    setPending(true);
    try {
      const { saved: isSaved } = await toggle({ data: { sourceTripId: payload.sourceTripId } });
      if (isSaved) {
        // Clone into the user's local trip store as a draft.
        tripsApi.createTrip({
          status: "draft",
          title: payload.title,
          subtitle: payload.subtitle,
          region: payload.region,
          origin: payload.origin,
          destination: payload.destination,
          distanceKm: payload.distanceKm,
          drivingTime: payload.drivingTime,
          cover: payload.cover as CoverKey,
          style: payload.style as RouteStyle,
          vehicle: payload.vehicle as VehicleType,
        });
        cachedSavedIds?.add(payload.sourceTripId);
        toast.success("Tur lagret! Du finner den under Mine turer.");
      } else {
        cachedSavedIds?.delete(payload.sourceTripId);
        toast("Lagring fjernet");
      }
      notify();
    } catch {
      toast.error("Kunne ikke lagre turen");
    } finally {
      setPending(false);
    }
  };

  const Icon = saved ? BookmarkCheck : Bookmark;
  const text = saved ? "Lagret" : "Lagre til mine turer";

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors ${
          saved
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-surface hover:border-primary hover:text-primary"
        } ${pending ? "opacity-60" : ""} ${className}`}
      >
        <Icon className="h-4 w-4" /> {saved ? "✓ Lagret" : `💾 ${text}`}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        saved
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground"
      } ${pending ? "opacity-60" : ""} ${className}`}
      aria-pressed={saved}
    >
      <Icon className="h-3 w-3" /> {saved ? "Lagret" : "Lagre"}
    </button>
  );
}
