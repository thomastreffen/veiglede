import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicProfileByUsername, type PublicProfileTrip, type PublicProfilePayload, type PublicProfileVehicle } from "@/lib/profiles.functions";
import { COVERS, vehicleMeta, styleMeta, type CoverKey, type VehicleType, type RouteStyle } from "@/lib/trips-store";
import { energyMeta, type EnergyType } from "@/lib/vehicles-store";
import { Route as RouteIcon, Clock, Camera, MapPin, ArrowRight, Share2 } from "lucide-react";
import { toast } from "sonner";

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
  const { profile, stats, vehicles = [], trips = [] } = data;
  const initialLetter = (profile.displayName || profile.username).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-24 w-24 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-5xl overflow-hidden shrink-0">
            {profile.avatarUrl
              ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              : initialLetter}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl uppercase truncate">{profile.displayName}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm leading-relaxed max-w-prose">{profile.bio}</p>}
            {stats && (
              <p className="mt-2 text-xs uppercase tracking-wider text-primary">
                {stats.tripsCount} turer planlagt · {stats.totalKm.toLocaleString("nb-NO")} km totalt
              </p>
            )}
          </div>
        </header>

        {vehicles.length > 0 && (
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
                        <p className="text-[11px] text-muted-foreground">{tm.emoji} {tm.label} · {em.emoji} {em.label}</p>
                        <p className="mt-0.5 text-[11px] text-primary uppercase tracking-wider">{sm.emoji} {sm.label}</p>
                      </div>
                    </div>
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

        <section className="mt-10">
          <h2 className="font-display text-xl uppercase">Offentlige turer</h2>
          {trips.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Ingen offentlige turer enda.</p>
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((t) => <ProfileTripCard key={t.shareToken} t={t} ownerName={profile.displayName} />)}
            </ul>
          )}
        </section>

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

function ProfileTripCard({ t, ownerName }: { t: PublicProfileTrip; ownerName: string }) {
  const v = vehicleMeta(t.vehicle as VehicleType);
  const s = styleMeta(t.style as RouteStyle);
  const cover = (t.cover as CoverKey) ?? "fjord";
  const url = typeof window !== "undefined" ? `${window.location.origin}/shared/${t.shareToken}` : `/shared/${t.shareToken}`;
  const onShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const data = { title: t.title, text: `Tur av ${ownerName} på Veiglede`, url };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share(data); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Lenke kopiert!");
  };
  return (
    <li>
      <Link to="/shared/$shareToken" params={{ shareToken: t.shareToken }} className="group block rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/60 transition-colors">
        <div className={`relative h-24 bg-gradient-to-br ${COVERS[cover]}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] border border-border">
            {v.emoji} {s.emoji}
          </span>
          <button
            onClick={onShare}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2 py-1 text-[10px] border border-border hover:text-primary"
          >
            <Share2 className="h-3 w-3" /> Del
          </button>
        </div>
        <div className="p-4">
          {t.region && <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}</p>}
          <h3 className="mt-1 font-display text-lg uppercase leading-tight group-hover:text-primary">{t.title}</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><RouteIcon className="h-3 w-3" /> {t.distanceKm} km</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {t.drivingTime}</span>
            <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> {t.stopsCount}</span>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <MapPin className="h-3 w-3 shrink-0" /> {t.origin} → {t.destination}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary">Se tur <ArrowRight className="h-3 w-3" /></span>
        </div>
      </Link>
    </li>
  );
}
