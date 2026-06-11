import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { tripsApi, type Trip, type TripDay, type Stop } from "@/lib/trips-store";
import { getPublicTripByToken } from "@/lib/public-trips.functions";

interface Props {
  /** Share token of the public/shared trip to copy. */
  shareToken: string;
  /** Original trip id — used for duplicate-detection + attribution. */
  originalTripId: string;
  /** Display name of the original owner for the "Inspirert av X" line. */
  inspiredByDisplayName?: string;
  /**
   * Optional pre-fetched trip bundle. When provided we skip the round-trip
   * to getPublicTripByToken (used on the shared trip page which already has
   * the data loaded).
   */
  prefetched?: {
    trip: Partial<Trip> & { title: string };
    days: Array<Partial<TripDay>>;
    stops: Array<Partial<Stop> & { dayId: string }>;
  };
  className?: string;
  variant?: "primary" | "secondary";
  label?: string;
}

const PRIMARY = "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60";
const SECONDARY = "inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 backdrop-blur px-3 py-1.5 text-xs hover:border-primary hover:text-primary disabled:opacity-60";

export function CopyTripButton({
  shareToken,
  originalTripId,
  inspiredByDisplayName,
  prefetched,
  className,
  variant = "primary",
  label,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchTrip = useServerFn(getPublicTripByToken);
  const [pending, setPending] = useState(false);

  const base = variant === "primary" ? PRIMARY : SECONDARY;
  const cls = `${base} ${className ?? ""}`.trim();

  if (!user) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          const redirect = typeof window !== "undefined" ? window.location.pathname : undefined;
          navigate({ to: "/auth", search: { redirect } });
        }}
        className={cls}
      >
        <LogIn className="h-4 w-4" /> Logg inn for å kopiere tur
      </button>
    );
  }

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    // Duplicate detection — if a copy already exists, jump straight to it.
    const existing = tripsApi.findCopyByOriginalId(originalTripId);
    if (existing) {
      toast(`Du har allerede kopiert denne turen — åpner kopien.`);
      navigate({ to: "/trips/$tripId", params: { tripId: existing.id } });
      return;
    }

    setPending(true);
    try {
      let bundle = prefetched;
      if (!bundle) {
        const res = await fetchTrip({ data: { token: shareToken } });
        if (!res?.found || res.isPrivate || !res.trip) {
          toast.error("Kunne ikke hente turen.");
          return;
        }
        bundle = {
          trip: res.trip as unknown as Partial<Trip> & { title: string },
          days: (res.days ?? []) as unknown as Array<Partial<TripDay>>,
          stops: (res.stops ?? []) as unknown as Array<Partial<Stop> & { dayId: string }>,
        };
      }

      const copy = tripsApi.copyPublicTrip({
        sourceTrip: bundle.trip,
        sourceDays: bundle.days,
        sourceStops: bundle.stops,
        originalTripId,
        inspiredByDisplayName,
      });

      toast.success("Turen er kopiert til Mine turer", {
        action: {
          label: "Åpne tur",
          onClick: () => navigate({ to: "/trips/$tripId", params: { tripId: copy.id } }),
        },
      });
      navigate({ to: "/trips/$tripId", params: { tripId: copy.id } });
    } catch (err) {
      console.error("copy trip failed", err);
      toast.error("Kunne ikke kopiere turen.");
    } finally {
      setPending(false);
    }
  };

  return (
    <button type="button" onClick={onClick} disabled={pending} className={cls}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
      {label ?? (variant === "primary" ? "Kopier tur til mine turer" : "Kopier tur")}
    </button>
  );
}
