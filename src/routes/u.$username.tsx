import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicProfileByUsername, type PublicProfileTrip, type PublicProfilePayload, type PublicProfileVehicle } from "@/lib/profiles.functions";
import { vehicleMeta, styleMeta, type VehicleType, type RouteStyle } from "@/lib/trips-store";
import { energyMeta, type EnergyType } from "@/lib/vehicles-store";
import { FollowBlock } from "@/components/FollowBlock";
import { PublicTripCard } from "@/components/PublicTripCard";
import { AvatarImg } from "@/lib/avatar";

export const Route = createFileRoute("/u/$username")({
  head: ({ params, loaderData }: { params: { username: string }; loaderData?: PublicProfilePayload }) => {
    const p = loaderData?.profile;
    const stats = loaderData?.stats;

    const name = p?.displayName ?? params.username;
    const title = stats
      ? `${name} på Veiglede — ${stats.tripsCount} turer, ${stats.totalKm.toLocaleString("nb-NO")} km`
      : `${name} på Veiglede`;
    const desc = `Se turene og kjøretøyene til ${name} på Veiglede.`;
    const url = `https://veiglede.no/u/${params.username}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  loader: async ({ params }) => {
    const data = await getPublicProfileByUsername({ data: { username: params.username.toLowerCase() } });
    return data;
  },
  errorComponent: () => <NotFound />,
  notFoundComponent: () => <NotFound />,
  component: PublicProfilePage,
});

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <p className="font-display text-3xl uppercase">Profil ikke funnet</p>
        <p className="mt-2 text-sm text-muted-foreground">Brukeren finnes ikke, eller har en privat profil.</p>
        <Link to="/explore" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Utforsk turer</Link>
      </div>
    </div>
  );
}

function PrivateProfile({ name }: { name: string }) {
  return (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <div className="mx-auto h-16 w-16 rounded-2xl bg-surface-2 grid place-items-center text-3xl mb-4">🔒</div>
        <p className="font-display text-3xl uppercase">Denne profilen er privat</p>
        <p className="mt-2 text-sm text-muted-foreground">{name} har valgt å skjule profilen sin på Veiglede.</p>
        <Link to="/explore" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Utforsk turer</Link>
      </div>
    </div>
  );
}

function PublicProfilePage() {
  const params = Route.useParams();
  const initial = Route.useLoaderData();
  const fetcher = useServerFn(getPublicProfileByUsername);
  const { data } = useQuery({
    queryKey: ["public-profile", params.username],
    queryFn: () => fetcher({ data: { username: params.username.toLowerCase() } }),
    initialData: initial,
    staleTime: 60_000,
  });

  if (!data?.found || !data.profile) return <NotFound />;
  if (data.isPrivate) return <PrivateProfile name={data.profile.displayName} />;
  const { profile, stats, vehicles = [], trips = [], toggles } = data;
  const showGarage = toggles?.showGarage !== false;
  const showTrips = toggles?.showTrips !== false;
  const showStats = toggles?.showStats !== false;
  const initialLetter = (profile.displayName || profile.username).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-24 w-24 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-5xl overflow-hidden shrink-0">
            {profile.avatarUrl
              ? <AvatarImg value={profile.avatarUrl} className="h-full w-full object-cover" />
              : initialLetter}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl uppercase truncate">{profile.displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm leading-relaxed max-w-prose">{profile.bio}</p>}
            {showStats && stats && (
              <div className="mt-2 space-y-0.5 text-xs uppercase tracking-wider">
                <p className="text-primary">{stats.tripsCount} turer</p>
                <p className="text-muted-foreground">{stats.totalKm.toLocaleString("nb-NO")} km planlagt</p>
                <p className="text-muted-foreground">{stats.drivenKm.toLocaleString("nb-NO")} km kjørt</p>
              </div>
            )}
            <div className="mt-3">
              <FollowBlock userId={profile.id} username={profile.username} />
            </div>
          </div>
        </header>

        {showGarage && vehicles.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl uppercase">Garasje</h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((v: PublicProfileVehicle) => {

                const tm = vehicleMeta(v.type as VehicleType);
                const em = energyMeta(v.energy as EnergyType);
                const sm = styleMeta(v.defaultStyle as RouteStyle);
                return (
                  <li key={v.id} id={`vehicle-${v.id}`} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 rounded-xl border border-border bg-surface-2 overflow-hidden grid place-items-center text-2xl shrink-0">
                        {v.photo ? <img src={v.photo} alt="" className="h-full w-full object-cover" /> : <span>{tm.emoji}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base uppercase truncate">{v.name}</p>
                        {v.nickname && <p className="text-xs italic text-primary/90 truncate">"{v.nickname}"</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{tm.emoji} {tm.label} · {em.emoji} {em.label}</p>
                        <p className="mt-0.5 text-[11px] text-primary uppercase tracking-wider">{sm.emoji} {sm.label}</p>
                      </div>
                    </div>
                    {v.description && (
                      <p className="mt-3 text-xs leading-relaxed text-foreground/80 italic border-l-2 border-primary/40 pl-3">
                        {v.description}
                      </p>
                    )}
                    {v.photos.length > 0 && (
                      <div className="mt-3 flex gap-1.5 overflow-x-auto -mx-1 px-1">
                        {v.photos.map((p) => (
                          <img key={p.id} src={p.url} alt={p.caption ?? ""} className="h-16 w-16 rounded-md object-cover border border-border shrink-0" loading="lazy" />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {showTrips && (
          <section className="mt-10">
            <h2 className="font-display text-xl uppercase">Offentlige turer</h2>
            {trips.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Ingen offentlige turer enda.</p>
            ) : (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trips.map((t: PublicProfileTrip) => (
                  <li key={t.shareToken}>
                    <PublicTripCard
                      trip={{
                        id: t.id,
                        title: t.title,
                        subtitle: t.subtitle,
                        region: t.region,
                        origin: t.origin,
                        destination: t.destination,
                        distanceKm: t.distanceKm,
                        drivingTime: t.drivingTime,
                        stopsCount: t.stopsCount,
                        cover: t.cover,
                        style: t.style,
                        vehicle: t.vehicle,
                        shareToken: t.shareToken,
                      }}
                      ownerName={profile.displayName}
                      ownerUsername={profile.username}
                      ownerAvatarUrl={profile.avatarUrl}
                      status="offentlig"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center">
          <p className="font-display text-2xl uppercase">Følg med på Veiglede</p>
          <p className="mt-2 text-sm text-muted-foreground">Lag dine egne ruter, lagre kjøretøy og del turer med venner.</p>
          <Link to="/signup" className="mt-4 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
            Kom i gang gratis →
          </Link>
        </section>
      </div>
    </div>
  );
}

