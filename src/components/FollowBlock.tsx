import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getFollowStatsFn, toggleFollowFn, listFollowsFn, type FollowListEntry } from "@/lib/social.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarImg } from "@/lib/avatar";

interface Props {
  /** The profile being viewed. */
  userId: string;
  username: string;
  displayName?: string;
}

export function FollowBlock({ userId, username, displayName }: Props) {
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
  const [openList, setOpenList] = useState<null | "followers" | "following">(null);
  const isSelf = user?.id === userId;
  const isLoggedOut = !user;

  const onClick = async () => {
    if (isLoggedOut) {
      navigate({ to: "/auth" as never });
      return;
    }
    if (isSelf || pending) return;
    setPending(true);
    const wasFollowing = data?.isFollowing ?? false;
    try {
      await toggle({ data: { followingId: userId } });
      await refetch();
      const name = displayName || username;
      toast.success(wasFollowing ? `Du følger ikke lenger ${name}` : `Du følger ${name}`);
    } catch {
      toast.error("Kunne ikke oppdatere");
    } finally {
      setPending(false);
    }
  };

  const followers = data?.followers ?? 0;
  const following = data?.following ?? 0;
  const isFollowing = data?.isFollowing ?? false;

  const btnLabel = isLoggedOut
    ? "Logg inn for å følge"
    : isFollowing ? "Følger ✓" : "Følg";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {isSelf ? (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Dette er din profil</span>
        ) : (
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
            {isFollowing ? <Heart className="h-3.5 w-3.5 fill-current" /> : <UserPlus className="h-3.5 w-3.5" />}
            {btnLabel}
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          <button type="button" onClick={() => setOpenList("followers")} className="hover:underline">
            <span className="font-semibold text-foreground">{followers.toLocaleString("nb-NO")}</span> følgere
          </button>
          {" · "}
          <button type="button" onClick={() => setOpenList("following")} className="hover:underline">
            følger <span className="font-semibold text-foreground">{following.toLocaleString("nb-NO")}</span>
          </button>
        </p>
      </div>

      <Dialog open={openList !== null} onOpenChange={(o) => !o && setOpenList(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{openList === "followers" ? "Følgere" : "Følger"}</DialogTitle>
          </DialogHeader>
          {openList && <FollowList userId={userId} direction={openList} onNavigate={() => setOpenList(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FollowList({
  userId, direction, onNavigate,
}: { userId: string; direction: "followers" | "following"; onNavigate: () => void }) {
  const fetcher = useServerFn(listFollowsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["follow-list", direction, userId],
    queryFn: () => fetcher({ data: { userId, direction } }),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Laster…</p>;
  const list = data ?? [];
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {direction === "followers" ? "Ingen offentlige følgere enda." : "Følger ingen offentlige profiler enda."}
      </p>
    );
  }
  return (
    <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border -mx-2">
      {list.map((p: FollowListEntry) => (
        <li key={p.id} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-10 w-10 rounded-full bg-primary/15 text-primary grid place-items-center overflow-hidden shrink-0 font-semibold">
            {p.avatarUrl
              ? <AvatarImg value={p.avatarUrl} className="h-full w-full object-cover" />
              : p.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              to="/u/$username"
              params={{ username: p.username }}
              onClick={onNavigate}
              className="block truncate font-medium hover:underline"
            >
              {p.displayName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">@{p.username}{p.bio ? ` · ${p.bio}` : ""}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
