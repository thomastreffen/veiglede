import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, HeartOff, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getFollowStatsFn, toggleFollowFn } from "@/lib/social.functions";

interface Props {
  /** The profile being viewed. */
  userId: string;
  username: string;
}

export function FollowBlock({ userId, username }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetcher = useServerFn(getFollowStatsFn);
  const toggle = useServerFn(toggleFollowFn);

  const { data, refetch } = useQuery({
    queryKey: ["follow-stats", userId, user?.id ?? "anon"],
    queryFn: () => fetcher({ data: { userId, viewerId: user?.id } }),
    staleTime: 30_000,
  });

  const [pending, setPending] = useState(false);
  const isSelf = user?.id === userId;

  const onClick = async () => {
    if (!user) {
      navigate({ to: "/signup" });
      return;
    }
    void username;
    if (isSelf || pending) return;
    setPending(true);
    try {
      await toggle({ data: { followingId: userId } });
      await refetch();
    } catch {
      toast.error("Kunne ikke oppdatere");
    } finally {
      setPending(false);
    }
  };

  const followers = data?.followers ?? 0;
  const following = data?.following ?? 0;
  const isFollowing = data?.isFollowing ?? false;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isSelf && (
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
            isFollowing
              ? "border border-primary bg-primary/10 text-primary"
              : "bg-primary text-primary-foreground hover:brightness-110"
          } ${pending ? "opacity-60" : ""}`}
        >
          {isFollowing ? <><Heart className="h-3.5 w-3.5 fill-current" /> Følger ✓</> : <><UserPlus className="h-3.5 w-3.5" /> Følg</>}
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{followers.toLocaleString("nb-NO")}</span> følgere
        {" · følger "}
        <span className="font-semibold text-foreground">{following.toLocaleString("nb-NO")}</span>
      </p>
    </div>
  );
}
