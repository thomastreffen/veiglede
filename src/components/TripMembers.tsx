import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { listTripMembers, type TripMember } from "@/lib/trip-invites";

interface Props {
  tripId: string;
  onOpenShare?: () => void;
}

export function TripMembers({ tripId, onOpenShare }: Props) {
  const [members, setMembers] = useState<TripMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    listTripMembers(tripId)
      .then((m) => { if (!cancelled) setMembers(m); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [tripId]);

  if (members.length === 0) return null;
  const visible = members.slice(0, 3);
  const extra = members.length - visible.length;

  return (
    <button
      type="button"
      onClick={onOpenShare}
      title={members.map((m) => `${m.name ?? "Reisefølge"} er med på denne turen`).join("\n")}
      className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-2 py-1 text-xs hover:border-primary"
    >
      <Users className="h-3 w-3 text-primary" />
      <span className="flex -space-x-1.5">
        {visible.map((m) => (
          <span
            key={m.user_id}
            title={`${m.name ?? "Reisefølge"} er med på denne turen`}
            className="h-5 w-5 rounded-full ring-2 ring-background bg-primary/20 grid place-items-center text-[9px] font-bold text-primary overflow-hidden"
          >
            {m.avatar_url
              ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
              : (m.name?.[0] ?? "?").toUpperCase()}
          </span>
        ))}
      </span>
      {extra > 0 && <span className="text-[10px] text-muted-foreground">+{extra} mer</span>}
    </button>
  );
}
