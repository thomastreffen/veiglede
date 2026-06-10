import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  getTripReactionsFn, toggleReactionFn,
  type ReactionKey, type TripReactionCounts,
} from "@/lib/social.functions";

const LABELS: Record<ReactionKey, { emoji: string; label: string }> = {
  fire: { emoji: "🔥", label: "Kult" },
  clap: { emoji: "👏", label: "Bra tur" },
  pin: { emoji: "📍", label: "Vil kjøre" },
};

interface Props {
  tripId: string;
  /** Optional initial counts. If omitted, fetched from server. */
  initial?: TripReactionCounts;
  size?: "sm" | "md";
}

export function TripReactionsRow({ tripId, initial, size = "sm" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetcher = useServerFn(getTripReactionsFn);
  const toggle = useServerFn(toggleReactionFn);

  const { data, refetch } = useQuery({
    queryKey: ["trip-reactions", tripId, user?.id ?? "anon"],
    queryFn: async () => {
      try {
        return await fetcher({ data: { tripIds: [tripId], viewerId: user?.id } });
      } catch {
        return { [tripId]: { fire: 0, clap: 0, pin: 0, mine: [] } } as Record<string, TripReactionCounts>;
      }
    },
    initialData: initial ? { [tripId]: initial } : undefined,
    staleTime: 30_000,
    retry: false,
    throwOnError: false,
  });
  const counts = data?.[tripId] ?? { fire: 0, clap: 0, pin: 0, mine: [] };

  const [pending, setPending] = useState<ReactionKey | null>(null);

  const onClick = async (e: React.MouseEvent, r: ReactionKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate({ to: "/signup" });
      return;
    }
    if (pending) return;
    setPending(r);
    try {
      await toggle({ data: { tripId, reaction: r } });
      await refetch();
    } catch {
      toast.error("Kunne ikke oppdatere reaksjonen");
    } finally {
      setPending(null);
    }
  };

  const px = size === "md" ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]";

  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(LABELS) as ReactionKey[]).map((r) => {
        const active = counts.mine.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={(e) => onClick(e, r)}
            disabled={pending === r}
            className={`inline-flex items-center gap-1 rounded-full border transition-colors ${px} ${
              active
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground"
            } ${pending === r ? "opacity-60" : ""}`}
            aria-pressed={active}
            aria-label={LABELS[r].label}
          >
            <span>{LABELS[r].emoji}</span>
            <span>{LABELS[r].label}</span>
            <span className="font-semibold tabular-nums">{counts[r]}</span>
          </button>
        );
      })}
    </div>
  );
}
