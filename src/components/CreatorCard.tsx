import { Link } from "@tanstack/react-router";
import { AvatarImg } from "@/lib/avatar";
import { FollowBlock } from "@/components/FollowBlock";

interface Props {
  ownerId?: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  /** Whether the underlying profile is public (controls the link/follow). */
  isPublicProfile: boolean;
}

/** Creator identity block for the bottom of a public trip page. */
export function CreatorCard({ ownerId, displayName, username, avatarUrl, isPublicProfile }: Props) {
  const initial = displayName.charAt(0).toUpperCase();
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Om denne reisende</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/15 grid place-items-center text-base font-bold text-primary overflow-hidden shrink-0">
          {avatarUrl
            ? <AvatarImg value={avatarUrl} className="h-full w-full object-cover" />
            : initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg uppercase truncate">{displayName}</p>
          {isPublicProfile && username ? (
            <Link
              to="/u/$username"
              params={{ username }}
              className="text-xs text-primary hover:underline"
            >
              @{username}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Privat profil</p>
          )}
        </div>
      </div>

      {isPublicProfile && username && ownerId && (
        <div className="mt-4">
          <FollowBlock userId={ownerId} username={username} displayName={displayName} />
        </div>
      )}
    </section>
  );
}
