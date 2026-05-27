import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  useTripsStore, tripsApi, stopMeta, STOP_TYPES, vehicleMeta, styleMeta,
  COVERS, type CoverKey, getRouteSuggestions, getPartnerTips, getPhotoMemories,
  type SuggestedStop, type PartnerTip,
} from "@/lib/trips-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { useTripTracking, statusMeta } from "@/lib/trip-tracking";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { DemoDebugPanel } from "@/components/DemoDebugPanel";
import { ShareTripModal } from "@/components/ShareTripModal";
import { TripTracker } from "@/components/TripTracker";
import { TripMemories } from "@/components/TripMemories";
import {
  Plus, Trash2, ArrowLeft, BookOpen, Clock, MapPin, Route as RouteIcon,
  Camera, Sparkles, Share2, ChevronUp, ChevronDown, Info, Star, Tag, Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId")({
  head: () => ({ meta: [{ title: "Tur — Veiglede" }] }),
  component: TripPlanner,
});

function TripPlanner() {
  const { tripId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { trips, days, stops } = useTripsStore();
  const prefs = useDriverPrefs();
  const tracking = useTripTracking(tripId);
  const trackMeta = statusMeta(tracking.status);
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const trip = trips.find((t) => t.id === tripId);

  if (pathname !== `/trips/${tripId}`) {
    return <Outlet />;
  }

  if (!trip) {
    return (
      <div className="py-12 text-center">
        <p className="font-display text-2xl uppercase">Tur ikke funnet</p>
        <Link to="/trips" className="mt-4 inline-block text-sm text-primary underline">Tilbake til mine turer</Link>
      </div>
    );
  }

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const tripStops = stops.filter((st) => tripDays.some((d) => d.id === st.dayId));
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);
  const totalStops = tripStops.length;

  const suggestions = getRouteSuggestions(trip, prefs.stopInterests);
  const partnerTips = getPartnerTips(trip);
  const memories = getPhotoMemories(trip, tripStops);

  return (
    <div className="py-4">
      <DemoDebugPanel
        title="Planner debug"
        items={[
          { label: "Route", value: `/trips/${tripId}` },
          { label: "Trip", value: trip.id },
          { label: "Days", value: tripDays.length },
          { label: "Stops", value: totalStops },
        ]}
      />

      <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mine turer
      </Link>

      {/* Hero cover */}
      <section className={`mt-4 relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${COVERS[trip.cover as CoverKey]} p-5 md:p-8`}>
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
        <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,180 C80,160 120,80 200,100 C280,120 320,40 400,60" fill="none" stroke="oklch(0.78 0.17 65 / 0.6)" strokeWidth="2" />
        </svg>
        <div className="relative">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">
              {v.emoji} {v.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">
              {s.emoji} {s.label}
            </span>
            {trip.region && <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 backdrop-blur border border-border px-3 py-1 text-xs">{trip.region}</span>}
            <span className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur border px-3 py-1 text-xs font-semibold bg-background/60 ${trackMeta.cls}`}>{trackMeta.emoji} {trackMeta.label}</span>
          </div>
          <h1 className="mt-5 font-display text-4xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
          {trip.subtitle && <p className="mt-2 text-sm md:text-base text-foreground/80">{trip.subtitle}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><MapPin className="h-4 w-4 text-primary" /> {trip.origin} → {trip.destination}</p>
        </div>
      </section>

      {/* Stat row */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <BigStat icon={<RouteIcon className="h-4 w-4" />} label="Distanse" value={`${trip.distanceKm} km`} />
        <BigStat icon={<Clock className="h-4 w-4" />} label="Kjøretid" value={trip.drivingTime} />
        <BigStat icon={<Camera className="h-4 w-4" />} label="Stopp" value={String(totalStops)} />
      </section>

      {/* Map */}
      <section className="mt-4">
        <MapPlaceholder height="h-44 md:h-64" labels={[trip.origin, trip.destination]} distance={`${trip.distanceKm} km`} time={trip.drivingTime} />
      </section>

      {/* AI explanation */}
      {trip.aiSummary && (
        <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
            <Sparkles className="h-4 w-4" /> AI ko-pilot
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
        </section>
      )}

      {/* Primary actions */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/trips/$tripId/roadbook" params={{ tripId }}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          <BookOpen className="h-4 w-4" /> Åpne roadbook
        </Link>
        <button
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3.5 text-sm font-medium hover:bg-surface-2 hover:border-primary">
          <Share2 className="h-4 w-4" /> Del tur
        </button>
      </section>

      <ShareTripModal trip={trip} open={shareOpen} onOpenChange={setShareOpen} />

      {/* Trip tracking */}
      <section id="track" className="mt-4 scroll-mt-24">
        <TripTracker tripId={tripId} tripStops={tripStops} vehicleLabel={`${v.emoji} ${v.label}`} />
      </section>

      {/* Memories (after completion) */}
      <TripMemories trip={trip} tripStops={tripStops} onShare={() => setShareOpen(true)} />

      {/* Quick-jump pills */}
      <nav className="mt-4 -mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto pb-1">
        {[
          { href: "#track", label: "Live tur" },
          { href: "#days", label: "Dag for dag" },
          { href: "#along", label: "Langs ruta" },
          { href: "#photos", label: "Bilder" },
          { href: "#tips", label: "Lokale tips" },
          { href: "#practical", label: "Praktisk" },
        ].map((p) => (
          <a key={p.href} href={p.href}
            className="shrink-0 inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary">
            {p.label}
          </a>
        ))}
      </nav>

      {/* Days */}
      <section id="days" className="mt-8 scroll-mt-24">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl uppercase">Dag for dag</h2>
          <button onClick={() => tripsApi.addDay(tripId)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs uppercase tracking-wider hover:border-primary">
            <Plus className="h-3.5 w-3.5" /> Legg til dag
          </button>
        </div>

        <ol className="mt-4 space-y-4">
          {tripDays.map((day) => {
            const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
            return (
              <li key={day.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="flex items-start gap-4 p-4 md:p-5 border-b border-border/60">
                  <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display text-xl shrink-0">{day.dayNumber}</div>
                  <div className="flex-1 min-w-0">
                    <input value={day.title} onChange={(e) => tripsApi.updateDay(day.id, { title: e.target.value })}
                      className="w-full font-display text-xl md:text-2xl uppercase bg-transparent outline-none focus:bg-surface-2 rounded px-1 -mx-1" />
                    <input value={day.summary ?? ""} placeholder="Kort beskrivelse av dagen…"
                      onChange={(e) => tripsApi.updateDay(day.id, { summary: e.target.value })}
                      className="mt-1 w-full text-sm text-muted-foreground bg-transparent outline-none focus:bg-surface-2 rounded px-1 -mx-1" />
                  </div>
                  <button onClick={() => { if (confirm("Slette dagen?")) tripsApi.deleteDay(day.id); }} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <ul className="divide-y divide-border/60">
                  {dayStops.map((stop, idx) => {
                    const meta = stopMeta(stop.type);
                    return (
                      <li key={stop.id} className="flex items-stretch">
                        <Link to="/trips/$tripId/stops/$stopId" params={{ tripId, stopId: stop.id }} className="flex flex-1 items-start gap-3 p-4 hover:bg-surface-2/60 transition-colors min-w-0">
                          <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-lg shrink-0">{meta.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{stop.name}</p>
                              <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                              {stop.photoOp && <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider"><ImageIcon className="h-2.5 w-2.5" /> Foto</span>}
                              {stop.promoted && <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 text-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wider">Partner</span>}
                            </div>
                            {stop.description && <p className="mt-1 text-sm text-foreground/80 line-clamp-2">{stop.description}</p>}
                            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              {stop.estimatedTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{stop.estimatedTime}</span>}
                              {stop.durationMin && <><span>·</span><span>{formatDuration(stop.durationMin)}</span></>}
                              {stop.distanceFromPrevKm !== undefined && idx > 0 && <><span>·</span><span>+{stop.distanceFromPrevKm} km</span></>}
                              {stop.location && <><span>·</span><span>{stop.location}</span></>}
                            </p>
                            {stop.reason && (
                              <p className="mt-2 text-[11px] text-primary/90 flex items-start gap-1 leading-relaxed">
                                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{stop.reason}</span>
                              </p>
                            )}
                          </div>
                        </Link>
                        <div className="flex flex-col items-center justify-center border-l border-border/60 px-1">
                          <button onClick={() => tripsApi.moveStop(stop.id, -1)} disabled={idx === 0}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label="Flytt opp">
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button onClick={() => tripsApi.moveStop(stop.id, 1)} disabled={idx === dayStops.length - 1}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-20 disabled:hover:text-muted-foreground" aria-label="Flytt ned">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button onClick={(e) => { e.preventDefault(); if (confirm(`Fjerne «${stop.name}»?`)) tripsApi.deleteStop(stop.id); }}
                            className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Fjern stopp">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {dayStops.length === 0 && (
                    <li className="px-5 py-6 text-sm text-muted-foreground italic">Ingen stopp på denne dagen enda.</li>
                  )}
                </ul>


                <div className="p-3 bg-background/40 border-t border-border/60 flex gap-2 overflow-x-auto">
                  {STOP_TYPES.slice(0, 8).map((t) => (
                    <button key={t.value}
                      onClick={() => {
                        const stop = tripsApi.addStop(day.id, { type: t.value, name: `Nytt ${t.label.toLowerCase()}` });
                        navigate({ to: "/trips/$tripId/stops/$stopId", params: { tripId, stopId: stop.id } });
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-3 py-1.5 text-xs hover:border-primary">
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Suggested along the route */}
      <section id="along" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Foreslått</p>
            <h2 className="mt-1 font-display text-2xl uppercase">Langs ruta</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">Trykk for å legge til</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Steder vi tror passer ruten — basert på {s.label.toLowerCase()}, {v.label.toLowerCase()} og dine interesser i profilen.</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((sug) => (
            <SuggestionCard key={sug.id} sug={sug} onAdd={() => tripsApi.addSuggestion(tripId, sug)} />
          ))}
        </div>
      </section>

      {/* Photo memories concept */}
      <section id="photos" className="mt-10 scroll-mt-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Foto</p>
        <h2 className="mt-1 font-display text-2xl uppercase">Bilder fra ruta</h2>
        <p className="mt-1 text-xs text-muted-foreground">Senere kan bilder du tar underveis kobles automatisk til turen basert på tid og posisjon.</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {memories.length === 0 && (
            <div className="col-span-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Legg til fotostopp så dukker plassholdere opp her.
            </div>
          )}
          {memories.map((m) => (
            <div key={m.id} className="aspect-square rounded-xl border border-border bg-gradient-to-br from-surface to-surface-2 grid place-items-center relative overflow-hidden">
              <span className="text-3xl">{m.emoji}</span>
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-background/90 to-transparent">
                <p className="text-[10px] uppercase tracking-wider truncate">{m.caption}</p>
                <p className="text-[9px] text-muted-foreground truncate">{m.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Partner tips */}
      <section id="tips" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Partnertips</p>
            <h2 className="mt-1 font-display text-2xl uppercase">Lokalt langs ruta</h2>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Veiglede er gratis. Lokale tips og partnere vises bare når de passer ruten din.</p>

        <div className="mt-4 space-y-3">
          {partnerTips.map((tip) => <PartnerCard key={tip.id} tip={tip} />)}
        </div>
      </section>

      {/* Practical info */}
      <section id="practical" className="mt-10 rounded-2xl border border-border bg-surface p-5 scroll-mt-24">
        <h2 className="font-display text-xl uppercase">Praktisk info</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>· Total distanse: {trip.distanceKm} km over {tripDays.length} {tripDays.length === 1 ? "dag" : "dager"}</li>
          <li>· Anslått kjøretid: {trip.drivingTime}</li>
          <li>· Kjøretøy: {v.label} · stil: {s.label}</li>
          {trip.startDate && <li>· Avreise: {new Date(trip.startDate).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}</li>}
          <li>· Husk: offline kart, kontanter til bom, lader/strøm</li>
        </ul>

        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-primary font-bold">Din kjørestil</p>
          <p className="mt-1.5 text-sm text-foreground/90">
            Stoppene er plassert slik at dagsetapper holdes innenfor <span className="font-semibold">{prefs.maxDrivingHours} timer</span> kjøring,
            med pause omtrent <span className="font-semibold">{formatPauseLabel(prefs.pauseEveryMin)}</span>.
          </p>
          {(prefs.drivingFlags["no-highway"] || prefs.drivingFlags["no-ferry"]) && (
            <p className="mt-1.5 text-sm text-foreground/90">
              Vi prøver å unngå {[prefs.drivingFlags["no-highway"] && "motorvei", prefs.drivingFlags["no-ferry"] && "ferger"].filter(Boolean).join(" og ")} der ruta tillater det.
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">Endre i Profil → Kjørepreferanser.</p>
        </div>

        <Link to="/trips/$tripId/roadbook" params={{ tripId }}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          <BookOpen className="h-4 w-4" /> Åpne roadbook
        </Link>
      </section>

      <button onClick={() => { if (confirm("Slette hele turen?")) { tripsApi.deleteTrip(tripId); navigate({ to: "/trips" }); } }}
        className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
        <Trash2 className="h-4 w-4" /> Slett tur
      </button>
    </div>
  );
}

function SuggestionCard({ sug, onAdd }: { sug: SuggestedStop; onAdd: () => void }) {
  const meta = stopMeta(sug.type);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col">
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-lg shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{sug.name}</p>
            {sug.badge && <BadgeChip kind={sug.badge} />}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{meta.label}{sug.location ? ` · ${sug.location}` : ""}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground/85">{sug.description}</p>
      <p className="mt-2 text-[11px] text-primary/90 flex items-start gap-1 leading-relaxed">
        <Info className="h-3 w-3 mt-0.5 shrink-0" /><span>{sug.reason}</span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <p className="text-[11px] text-muted-foreground">{sug.durationMin ? formatDuration(sug.durationMin) : "—"}{sug.photoOp ? " · 📸" : ""}</p>
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary border border-primary/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-primary/25">
          <Plus className="h-3 w-3" /> Legg til
        </button>
      </div>
    </div>
  );
}

function PartnerCard({ tip }: { tip: PartnerTip }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <span className="h-11 w-11 rounded-xl bg-surface-2 grid place-items-center text-xl shrink-0">{tip.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate">{tip.name}</p>
          <BadgeChip kind={tip.badge} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{tip.category} · {tip.location}</p>
        <p className="mt-2 text-sm text-foreground/85">{tip.blurb}</p>
      </div>
    </div>
  );
}

function BadgeChip({ kind }: { kind: "partner" | "promoted" | "local" }) {
  const map = {
    partner:  { label: "Partner",   className: "border-primary/40 text-primary",                 icon: <Tag className="h-2.5 w-2.5" /> },
    promoted: { label: "Promotert", className: "border-primary/40 text-primary bg-primary/10",   icon: <Star className="h-2.5 w-2.5" /> },
    local:    { label: "Lokalt tips", className: "border-border text-muted-foreground",          icon: <MapPin className="h-2.5 w-2.5" /> },
  } as const;
  const m = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${m.className}`}>
      {m.icon} {m.label}
    </span>
  );
}

function BigStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </p>
      <p className="mt-1 font-display text-lg md:text-2xl">{value}</p>
    </div>
  );
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60); const m = min % 60;
    return m ? `${h}t ${m}min` : `${h}t`;
  }
  return `${min} min`;
}

function formatPauseLabel(min: number): string {
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return h === 1 ? "hver time" : h === 2 ? "annenhver time" : `hver ${h}. time`;
  }
  return `hvert ${min}. minutt`;
}
