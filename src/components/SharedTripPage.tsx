import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  stopMeta, vehicleMeta, styleMeta, COVERS,
  type Trip, type TripDay, type Stop, type CoverKey,
} from "@/lib/trips-store";
import { getPublicTripByToken } from "@/lib/public-trips.functions";
import { publicPlaceName } from "@/lib/public-place";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { TripComments } from "@/components/TripComments";
import { LiveSharedBlock } from "@/components/LiveSharedBlock";
import { SaveTripButton } from "@/components/SaveTripButton";
import {
  MapPin, Clock, Route as RouteIcon, Sparkles, Eye, Lock, Camera, Compass,
} from "lucide-react";
import { useState } from "react";

export async function sharedTripLoader({ shareToken }: { shareToken: string }) {
  try {
    const data = await getPublicTripByToken({ data: { token: shareToken } });
    if (data?.found && !data.isPrivate && data.trip) {
      const t = data.trip as Record<string, unknown>;
      return {
        title: String(t.title ?? "Delt tur"),
        subtitle: typeof t.subtitle === "string" ? t.subtitle : undefined,
        origin: String(t.origin ?? ""),
        destination: String(t.destination ?? ""),
        region: typeof t.region === "string" ? t.region : undefined,
        distanceKm: Number(t.distanceKm ?? 0),
      };
    }
  } catch {
    // fall through to default head
  }
  return null;
}

export function sharedTripHead(loaderData: Awaited<ReturnType<typeof sharedTripLoader>> | undefined) {
  if (!loaderData) {
    return { meta: [{ title: "Delt tur — Veiglede" }] };
  }
  const pageTitle = `${loaderData.title} — Veiglede`;
  const pubOrigin = publicPlaceName(loaderData.origin);
  const pubDest = publicPlaceName(loaderData.destination);
  const desc = loaderData.subtitle
    ?? `${pubOrigin} → ${pubDest}${loaderData.region ? ` · ${loaderData.region}` : ""} · ${loaderData.distanceKm} km`;
  return {
    meta: [
      { title: pageTitle },
      { name: "description", content: desc },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
    ],
  };
}

export function SharedTripPage({ shareToken }: { shareToken: string }) {
  const fetchTrip = useServerFn(getPublicTripByToken);
  const { data, isLoading } = useQuery({
    queryKey: ["public-trip", shareToken],
    queryFn: () => fetchTrip({ data: { token: shareToken } }),
    staleTime: 30_000,
  });
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <p className="text-sm text-muted-foreground">Laster turen…</p>
      </div>
    );
  }

  if (!data?.found) {
    return <EmptyState title="Denne turen finnes ikke" body="Lenken kan være utløpt eller feil." />;
  }
  if (data.isPrivate) {
    return (
      <EmptyState
        icon={<Lock className="h-8 w-8 text-muted-foreground mx-auto" />}
        title="Denne turen er privat"
        body="Eieren har slått av offentlig deling. Spør om en ny lenke for å se turen."
      />
    );
  }

  const trip = data.trip as unknown as Trip;
  const days = ((data.days ?? []) as unknown as TripDay[]).slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const stops = (data.stops ?? []) as unknown as Stop[];
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);
  const allPhotos = stops.flatMap((st) => (st.photos ?? []).map((p) => ({ ...p, stopName: st.name })));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Veiglede"><VeigledeLogo size="md" /></Link>
          <div className="flex items-center gap-2">
            <SaveTripButton
              payload={{
                sourceTripId: trip.id,
                title: trip.title,
                subtitle: trip.subtitle,
                region: trip.region,
                origin: publicPlaceName(trip.origin),
                destination: publicPlaceName(trip.destination),
                distanceKm: trip.distanceKm,
                drivingTime: trip.drivingTime,
                cover: trip.cover,
                style: trip.style,
                vehicle: trip.vehicle,
              }}
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
              <Eye className="h-3 w-3" /> Delt turplan
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-16">
        <section className={`mt-4 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${COVERS[trip.cover as CoverKey]} p-6 md:p-8`}>
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Delt av en reisende</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{trip.title}</h1>
            {trip.subtitle && <p className="mt-2 text-sm text-foreground/80">{trip.subtitle}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {publicPlaceName(trip.origin)} → {publicPlaceName(trip.destination)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{v.emoji} {v.label}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{s.emoji} {s.label}</span>
            </div>
          </div>
        </section>

        <LiveSharedBlock tripId={trip.id} />

        <section className="mt-4 grid grid-cols-3 gap-3">
          {[
            { Icon: RouteIcon, label: "Distanse", value: `${trip.distanceKm} km` },
            { Icon: Clock, label: "Kjøretid", value: trip.drivingTime },
            { Icon: Camera, label: "Dager", value: String(days.length) },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-3">
              <Icon className="h-4 w-4 text-primary" />
              <p className="mt-2 font-display text-xl uppercase">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {trip.aiSummary && (
          <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
              <Sparkles className="h-4 w-4" /> Om denne ruta
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="font-display text-2xl uppercase">Dag for dag</h2>
          <ol className="mt-3 space-y-3">
            {days.map((day) => {
              const dayStops = stops.filter((st) => st.dayId === day.id).sort((a, b) => a.order - b.order);
              return (
                <li key={day.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-2xl uppercase text-primary">Dag {day.dayNumber}</span>
                    {day.date && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{day.date}</span>}
                  </div>
                  <p className="font-display text-lg uppercase">{day.title}</p>
                  {day.summary && <p className="text-xs text-muted-foreground mt-0.5">{day.summary}</p>}
                  <ul className="mt-3 space-y-2">
                    {dayStops.map((stop) => {
                      const meta = stopMeta(stop.type);
                      return (
                        <li key={stop.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                          <div className="flex items-start gap-2.5 text-sm">
                            <span className="h-7 w-7 rounded-lg bg-surface-2 grid place-items-center shrink-0">{meta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{stop.name}</p>
                              {stop.location && <p className="text-[11px] text-muted-foreground">{stop.location}</p>}
                              {stop.description && <p className="text-xs text-muted-foreground mt-1">{stop.description}</p>}
                            </div>
                            {stop.estimatedTime && <span className="text-[11px] text-muted-foreground shrink-0">{stop.estimatedTime}</span>}
                          </div>
                          {stop.photos && stop.photos.length > 0 && (
                            <div className="mt-2 flex gap-1.5 overflow-x-auto">
                              {stop.photos.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setLightbox(p.url)}
                                  className="h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0 hover:border-primary"
                                >
                                  <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>

        {allPhotos.length > 0 && (
          <section className="mt-6">
            <h2 className="font-display text-2xl uppercase">Bilder fra ruta</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {allPhotos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightbox(p.url)}
                  className="aspect-square rounded-xl overflow-hidden border border-border hover:border-primary"
                >
                  <img src={p.url} alt={p.stopName} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </section>
        )}

        <TripComments tripId={trip.id} />

        <section className="mt-8 rounded-2xl border border-dashed border-border p-5 text-center">
          <p className="text-xs text-muted-foreground">Inspirert? Lag din egen versjon.</p>
          <Link
            to="/trips/new"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
          >
            <Compass className="h-4 w-4" /> Planlegg en lignende tur
          </Link>
        </section>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur grid place-items-center p-4 cursor-zoom-out"
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        {icon ?? <Lock className="h-8 w-8 text-muted-foreground mx-auto" />}
        <p className="mt-3 font-display text-2xl uppercase">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{body}</p>
        <Link to="/" className="mt-5 inline-flex text-sm text-primary underline">Tilbake til Veiglede</Link>
      </div>
    </div>
  );
}
