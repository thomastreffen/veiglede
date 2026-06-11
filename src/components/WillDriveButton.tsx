import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, LogIn, Loader2, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getTripReactionsFn, toggleReactionFn,
  type TripReactionCounts,
} from "@/lib/social.functions";

interface Props {
  tripId: string;
  className?: string;
  initial?: TripReactionCounts;
}

const EMPTY: TripReactionCounts = { fire: 0, road: 0, pin: 0, coffee: 0, drive: 0, mine: [] };

/**
 * High-intent "Vil kjøre denne" CTA. Tied to the `drive` reaction so the
 * count is shared with the reactions row and social stats.
 */
export function WillDriveButton({ tripId, className = "", initial }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetcher = useServerFn(getTripReactionsFn);
  const toggle = useServerFn(toggleReactionFn);
  const [pending, setPending] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["trip-reactions", tripId, user?.id ?? "anon"],
    queryFn: async () => {
      try {
        return await fetcher({ data: { tripIds: [tripId], viewerId: user?.id } });
      } catch {
        return { [tripId]: EMPTY } as Record<string, TripReactionCounts>;
      }
    },
    initialData: initial ? { [tripId]: initial } : undefined,
    staleTime: 30_000,
    retry: false,
    throwOnError: false,
  });
  const counts = data?.[tripId] ?? EMPTY;
  const active = counts.mine.includes("drive");
  const count = counts.drive;

  if (!user) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          const redirect = typeof window !== "undefined" ? window.location.pathname : undefined;
          navigate({ to: "/auth", search: { redirect } });
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 ${className}`}
      >
        <LogIn className="h-4 w-4" /> Logg inn for å lagre denne turen
      </button>
    );
  }

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    try {
      await toggle({ data: { tripId, reaction: "drive" } });
      await refetch();
      if (!active) toast.success("Lagt til i ønskelista — Vil kjøre denne 🏁");
    } catch {
      toast.error("Kunne ikke oppdatere");
    } finally {
      setPending(false);
    }
  };

  const base = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors";
  const styled = active
    ? `${base} border border-primary bg-primary/15 text-primary`
    : `${base} bg-primary text-primary-foreground hover:brightness-110`;

  return (
    <button type="button" onClick={onClick} disabled={pending} className={`${styled} ${pending ? "opacity-60" : ""} ${className}`}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" />
        : active ? <Check className="h-4 w-4" />
        : <Flag className="h-4 w-4" />}
      {active ? "Vil kjøre ✓" : "Vil kjøre denne"}
      {count > 0 && <span className="ml-1 rounded-full bg-background/30 px-2 py-0.5 text-[10px] font-semibold tabular-nums">{count}</span>}
    </button>
  );
}
