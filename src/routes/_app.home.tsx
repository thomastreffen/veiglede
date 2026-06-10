import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Map as MapIcon, Compass, ArrowRight, Car, Bike, Caravan,
  Sparkles, Users, Gift,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTripsStore, vehicleMeta, styleMeta, COVERS, type CoverKey, type VehicleType, type RouteStyle } from "@/lib/trips-store";
import { useVehicles } from "@/lib/vehicles-store";
import { fetchPublicTrips } from "@/lib/public-trips";
import { feedFromFollowsFn, getFollowStatsFn } from "@/lib/social.functions";
import { PublicTripCard } from "@/components/PublicTripCard";
import { AvatarImg } from "@/lib/avatar";

export const Route = createFileRoute("/_app/home")({
  head: () => ({
    meta: [
      { title: "Hjem — Veiglede" },
      { name: "description", content: "Din personlige Veiglede-dashboard: fortsett turer, utforsk og se garasjen din." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-10 text-center text-muted-foreground text-sm">Laster…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <Dashboard />;
}

function Dashboard() {
  const { user } = useAuth();
  const { trips } = useTripsStore();
  const { vehicles } = useVehicles();

  // Profile lookup for personal name + avatar
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setProfile({
          display_name: (data.display_name as string | null) ?? null,
          avatar_url: (data.avatar_url as string | null) ?? null,
        });
      });
  }, [user]);

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
  const displayName = profile?.display_name || meta.full_name || meta.name || user?.email?.split("@")[0] || "venn";
  const avatarValue = profile?.avatar_url || meta.avatar_url || "";
  const firstName = displayName.split(" ")[0];

  // Continue trip — prefer saved trips, most recently created/edited first
  const recentTrips = useMemo(() => {
    const visible = trips.filter((t) => t.status !== "draft");
    return [...visible].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 3);
  }, [trips]);
  const continueTrip = recentTrips[0];

  // Public trips for inspiration
  const fetchPublic = useServerFn(fetchPublicTrips);
  const { data: publicTrips } = useQuery({
    queryKey: ["home-public-trips"],
    queryFn: () => fetchPublic(),
    staleTime: 5 * 60 * 1000,
  });
  const inspirationTrips = (publicTrips ?? []).slice(0, 6);

  // Feed from people user follows
  const fetchFeed = useServerFn(feedFromFollowsFn);
  const { data: feedTrips } = useQuery({
    queryKey: ["home-follow-feed", user!.id],
    queryFn: () => fetchFeed(),
    staleTime: 60_000,
  });

  // Follow stats
  const fetchStats = useServerFn(getFollowStatsFn);
  const { data: stats } = useQuery({
    queryKey: ["home-follow-stats", user!.id],
    queryFn: () => fetchStats({ data: { userId: user!.id } }),
    staleTime: 60_000,
  });

  const garageVehicles = vehicles.filter((v) => !v.isDemo).slice(0, 3);
  const primaryVehicle = garageVehicles[0];
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="py-5 md:py-8 space-y-10">
      {/* Hero */}
      <section className="rounded-2xl border border-border bg-surface p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Hei {firstName}</p>
            <h1 className="mt-2 font-display text-3xl md:text-4xl uppercase leading-[0.95]">
              Klar for neste tur?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Planlegg, fortsett der du slapp, eller la deg inspirere av andres turer.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/trips/new"
                search={() => ({ restoreDraft: "fresh", ts: String(Date.now()) })}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> Start ny tur
              </Link>
              <Link to="/trips" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2 text-sm hover:border-primary hover:text-primary">
                <MapIcon className="h-4 w-4" /> Mine turer
              </Link>
              <Link to="/explore" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2 text-sm hover:border-primary hover:text-primary">
                <Compass className="h-4 w-4" /> Utforsk turer
              </Link>
            </div>
          </div>
          <Link to="/settings" className="hidden sm:grid place-items-center h-14 w-14 rounded-full bg-primary/15 text-primary text-lg font-bold overflow-hidden shrink-0" title="Profil">
            {avatarValue ? <AvatarImg value={avatarValue} className="h-full w-full object-cover" /> : initial}
          </Link>
        </div>
        {stats && (stats.followers > 0 || stats.following > 0) && (
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{stats.followers}</strong> følgere</span>
            <span><strong className="text-foreground">{stats.following}</strong> følger</span>
          </div>
        )}
      </section>

      {/* Continue trip */}
      <section>
        <SectionHead title="Fortsett reisen" />
        {continueTrip ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentTrips.map((t) => {
              const v = vehicleMeta(t.vehicle as VehicleType);
              const s = styleMeta(t.style as RouteStyle);
              return (
                <Link
                  key={t.id}
                  to="/trips/$tripId"
                  params={{ tripId: t.id }}
                  className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/60 transition-colors"
                >
                  <div className={`relative h-24 bg-gradient-to-br ${COVERS[(t.cover as CoverKey) ?? "fjord"]}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] border border-border">
                      {v.emoji} {s.emoji}
                    </span>
                    {t.isPublic && (
                      <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-primary/15 text-primary border border-primary/30 backdrop-blur px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        Delt
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    {t.region && <p className="text-[10px] uppercase tracking-wider text-primary">{t.region}</p>}
                    <h3 className="mt-0.5 font-display text-base uppercase leading-tight group-hover:text-primary">{t.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.distanceKm} km · {t.drivingTime} · {t.stopsCount} stopp
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-primary">
                      Åpne tur <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyCard
            title="Du har ingen turer enda"
            body="Start din første tur — vi hjelper deg med ruten, stoppene og roadbook."
            ctaLabel="Start din første tur"
            ctaTo="/trips/new"
          />
        )}
      </section>

      {/* Inspiration */}
      {inspirationTrips.length > 0 && (
        <section>
          <SectionHead title="Populært i Veiglede" linkTo="/explore" linkLabel="Se alle" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inspirationTrips.map((t) => (
              <PublicTripCard
                key={t.shareToken}
                trip={t}
                ownerName={t.ownerName}
                ownerAvatarUrl={t.ownerAvatarUrl}
                ownerUsername={t.ownerUsername}
                status="offentlig"
              />
            ))}
          </div>
        </section>
      )}

      {/* Vehicle suggestion chips */}
      <section>
        <SectionHead
          title={primaryVehicle ? `Forslag for ${primaryVehicle.nickname || primaryVehicle.name}` : "Finn turer for kjøretøyet ditt"}
        />
        <div className="flex flex-wrap gap-2">
          <VehicleChip to="motorcycle" label="Motorsykkel" Icon={Bike} />
          <VehicleChip to="car" label="Bil" Icon={Car} />
          <VehicleChip to="rv" label="Bobil" Icon={Caravan} />
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-xs hover:border-primary hover:text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" /> Alle turer
          </Link>
        </div>
      </section>

      {/* From people you follow */}
      <section>
        <SectionHead title="Fra folk du følger" linkTo="/explore" linkLabel="Utforsk folk" />
        {feedTrips && feedTrips.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feedTrips.slice(0, 3).map((t) => (
              <PublicTripCard
                key={t.shareToken}
                trip={t}
                ownerName={t.ownerName}
                ownerAvatarUrl={t.ownerAvatarUrl}
                status="offentlig"
              />
            ))}
          </div>
        ) : (
          <EmptyCard
            title="Følg noen profiler for å se turene deres her."
            body="Finn reisende du blir inspirert av i Utforsk."
            ctaLabel="Utforsk folk"
            ctaTo="/explore"
            ctaSearch={{ tab: "brukere" } as never}
            Icon={Users}
          />
        )}
      </section>

      {/* Garage preview */}
      <section>
        <SectionHead title="Din garasje" linkTo="/garage" linkLabel="Åpne garasjen" />
        {garageVehicles.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {garageVehicles.map((v) => (
              <Link
                key={v.id}
                to="/garage"
                className="group rounded-2xl border border-border bg-surface p-4 hover:border-primary/60 transition-colors flex items-center gap-3"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/15 grid place-items-center text-lg shrink-0 overflow-hidden">
                  {v.photo ? <img src={v.photo} alt="" className="h-full w-full object-cover" /> : (v.type === "motorcycle" ? "🏍️" : v.type === "rv" ? "🚐" : "🚗")}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm uppercase truncate group-hover:text-primary">{v.nickname || v.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{v.name}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyCard
            title="Ingen kjøretøy enda"
            body="Legg til kjøretøyet ditt for bedre rute- og stoppforslag."
            ctaLabel="Åpne garasjen"
            ctaTo="/garage"
            Icon={Car}
          />
        )}
      </section>

      {/* Benefits soft link */}
      <section>
        <Link
          to="/fordeler"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary/60 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary shrink-0">
              <Gift className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm uppercase">Fordeler for turen din</p>
              <p className="text-[11px] text-muted-foreground truncate">Rabatter og tilbud underveis.</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}

function SectionHead({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-lg md:text-xl uppercase">{title}</h2>
      {linkTo && linkLabel && (
        <Link to={linkTo} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function VehicleChip({ to, label, Icon }: { to: "motorcycle" | "car" | "rv"; label: string; Icon: typeof Car }) {
  return (
    <Link
      to="/explore"
      search={{ vehicle: to } as never}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-xs hover:border-primary hover:text-primary"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function EmptyCard({
  title, body, ctaLabel, ctaTo, ctaSearch, Icon,
}: {
  title: string; body: string; ctaLabel: string; ctaTo: string;
  ctaSearch?: never; Icon?: typeof Compass;
}) {
  const I = Icon ?? Sparkles;
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-5 text-center">
      <div className="mx-auto h-10 w-10 grid place-items-center rounded-full bg-primary/15 text-primary">
        <I className="h-5 w-5" />
      </div>
      <p className="mt-3 font-display text-base uppercase">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <Link
        to={ctaTo}
        search={ctaSearch}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110"
      >
        {ctaLabel} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
