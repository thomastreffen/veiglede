import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useTripsStore, stopMeta, vehicleMeta, styleMeta,
  getPartnerTips, getPhotoMemories,
} from "@/lib/trips-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { energyMeta } from "@/lib/vehicles-store";
import { useTripTracking, trackingApi, statusMeta } from "@/lib/trip-tracking";
import { ShareTripModal } from "@/components/ShareTripModal";
import { TripCompanions } from "@/components/TripCompanions";
import { DemoDebugPanel } from "@/components/DemoDebugPanel";
import { TripMap } from "@/components/TripMap";
import { TripTimeBudget, TripDayTimeRow } from "@/components/TripTimeBudget";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { BookingInfo, BookingBadge } from "@/components/BookingInfo";
import { DayWeather } from "@/components/DayWeather";
import { PartnerStopBlock } from "@/components/PartnerStopBlock";
import { DayNavigate } from "@/components/DayNavigate";
import { dayDate, dayCoords } from "@/lib/weather";
import { ArrowLeft, Clock, Share2, Download, Info, Camera, Sparkles, Image as ImageIcon, MapPin, Star, Tag, Play, Flag, Bed, FileDown } from "lucide-react";
import { downloadGpx } from "@/lib/gpx-export";
import { useT } from "@/i18n/provider";

export const Route = createFileRoute("/_app/trips/$tripId/roadbook")({
  head: () => ({ meta: [{ title: "Roadbook — Veiglede" }] }),
  component: Roadbook,
});

function Roadbook() {
  const t = useT();
  const rb = t.app.roadbook;
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const prefs = useDriverPrefs();
  const tracking = useTripTracking(tripId);
  const trackMeta = statusMeta(tracking.status);
  const [shareOpen, setShareOpen] = useState(false);
  const trip = trips.find((tr) => tr.id === tripId);
  if (!trip) return <div className="py-10">{rb.notFound}</div>;

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const tripStops = stops.filter((s) => tripDays.some((d) => d.id === s.dayId));
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);
  const em = trip.energy ? energyMeta(trip.energy) : undefined;
  const vehicleDisplay = trip.vehicleName ?? v.label;
  const partnerTips = getPartnerTips(trip);
  const memories = getPhotoMemories(trip, tripStops);

  const fmtDur = (m?: number) => !m ? "" : m >= 60 ? `${Math.floor(m/60)}t${m%60?` ${m%60}min`:""}` : `${m} min`;

  const handleExportPdf = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="py-4 print-roadbook lg:relative lg:left-1/2 lg:right-1/2 lg:-ml-[50vw] lg:-mr-[50vw] lg:w-screen lg:py-0 lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:h-[calc(100vh-4rem)] lg:gap-0">
    <div className="lg:overflow-y-auto lg:px-6 xl:px-8 lg:py-6 lg:border-r lg:border-border lg:bg-surface">

      {/* Print-only header */}
      <div className="print-only mb-4" style={{ borderBottom: "1px solid #000", paddingBottom: "8px" }}>
        <p style={{ fontSize: "10pt", letterSpacing: "0.2em", textTransform: "uppercase" }}>{rb.printRoadbook}</p>
        <h1 style={{ fontSize: "22pt", margin: "4px 0 2px", fontWeight: 700 }}>{trip.title}</h1>
        {trip.subtitle && <p style={{ fontSize: "10pt", fontStyle: "italic" }}>{trip.subtitle}</p>}
        <p style={{ fontSize: "10pt", marginTop: "4px" }}>
          {trip.origin} → {trip.destination}{trip.region ? ` · ${trip.region}` : ""}
        </p>
        <p style={{ fontSize: "9pt", marginTop: "6px" }}>
          {trip.distanceKm} km · {trip.drivingTime} · {tripStops.length} · {vehicleDisplay} · {s.label}
          {trip.startDate ? ` · ${rb.departure(new Date(trip.startDate).toLocaleDateString("nb-NO"))}` : ""}
        </p>
      </div>
      <DemoDebugPanel
        title="Roadbook debug"
        items={[
          { label: "Route", value: `/trips/${tripId}/roadbook` },
          { label: "Trip", value: trip.id },
          { label: "Days", value: tripDays.length },
          { label: "Stops", value: tripStops.length },
        ]}
      />

      <div className="flex items-center justify-between print:hidden">
        <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {rb.planner}
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary hover:text-primary"><Share2 className="h-3.5 w-3.5" /> {rb.share}</button>
          <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary hover:text-primary"><Download className="h-3.5 w-3.5" /> {rb.exportPdf}</button>
          <button onClick={() => downloadGpx(trip, tripStops)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary hover:text-primary"><FileDown className="h-3.5 w-3.5" /> {rb.downloadGpx}</button>
        </div>
      </div>
      <ShareTripModal trip={trip} open={shareOpen} onOpenChange={setShareOpen} />

      <section className="mt-4 max-w-2xl mx-auto print:hidden">
        <TripCompanions tripId={tripId} onInvite={() => setShareOpen(true)} />
      </section>

      <header className="mt-6 text-center max-w-2xl mx-auto">
        <div className="flex justify-center mb-3"><VeigledeLogo size="sm" /></div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">{rb.eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
        <p className="mt-3 text-muted-foreground">{trip.origin} → {trip.destination}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{v.emoji} {vehicleDisplay}</span>
          {em && <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{em.emoji} {em.label}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{s.emoji} {s.label}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${trackMeta.cls}`}>{trackMeta.emoji} {trackMeta.label}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Stil: {s.label} — {s.sub}</p>

        <div className="mt-5 flex justify-center gap-2 flex-wrap print:hidden">
          {tracking.status === "idle" && (
            <button onClick={() => trackingApi.start(tripId)} className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
              <Play className="h-4 w-4" /> {rb.startTrip}
            </button>
          )}
          {tracking.status === "active" && (
            <button onClick={() => trackingApi.complete(tripId)} className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
              <Flag className="h-4 w-4" /> {rb.completeTrip}
            </button>
          )}
          <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-surface px-5 py-2.5 text-xs uppercase tracking-wider hover:border-primary">
            {rb.backToPlanner}
          </Link>
        </div>
      </header>

      <section className="mt-8 mx-auto max-w-2xl print:hidden">
        <TripMap
          trip={trip}
          days={tripDays}
          stops={tripStops}
          compact
          height="h-64 md:h-80"
        />
      </section>

      {trip.aiSummary && (
        <section className="mt-8 mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
              <Sparkles className="h-4 w-4" /> {rb.whyThisRoute}
            </p>
            <span className="text-[10px] uppercase tracking-wider rounded-full border border-primary/30 bg-background/40 px-2 py-0.5 text-primary">
              {rb.tailoredInterests(prefs.stopInterests.length)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{trip.aiSummary}</p>
        </section>
      )}

      <div className="mt-10 space-y-10 max-w-2xl mx-auto">
        <TripTimeBudget trip={trip} days={tripDays} stops={tripStops} showPerDay title={rb.timeBudget} />
        {tripDays.map((day) => {
          const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
          return (
            <section key={day.id} className="print-day rounded-2xl border border-border bg-surface p-5 md:p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl uppercase text-primary">{rb.dayLabel} {day.dayNumber}</span>
                {day.date && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{day.date}</span>}
              </div>
              <h2 className="mt-1 font-display text-2xl md:text-3xl uppercase">{day.title}</h2>
              {day.summary && <p className="mt-2 text-sm text-muted-foreground">{day.summary}</p>}
              {(() => {
                const coords = dayCoords(trip, dayStops);
                return <DayWeather lat={coords?.lat} lng={coords?.lng} date={dayDate(trip, day)} className="mt-3" />;
              })()}
              <TripDayTimeRow trip={trip} days={tripDays} stops={tripStops} dayId={day.id} startTime={dayStops[0]?.estimatedTime} />
              <div className="print:hidden -mx-5 md:-mx-6"><DayNavigate stops={dayStops} /></div>


              <ol className="mt-6 relative border-l-2 border-border ml-3 space-y-6">
                {dayStops.map((stop) => {
                  const meta = stopMeta(stop.type);
                  return (
                    <li key={stop.id} className="pl-6 relative">
                      <span className="absolute -left-[15px] top-0.5 h-7 w-7 rounded-full bg-background border-2 border-primary grid place-items-center text-sm">{meta.emoji}</span>
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <h3 className="font-semibold">{stop.name}</h3>
                        {stop.estimatedTime && <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" />{stop.estimatedTime}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="uppercase tracking-wider">{meta.label}</span>
                        {stop.location ? ` · ${stop.location}` : ""}
                        {stop.durationMin ? ` · ${fmtDur(stop.durationMin)}` : ""}
                        {stop.photoOp ? " · 📸" : ""}
                      </p>
                      {stop.description && <p className="mt-2 text-sm leading-relaxed">{stop.description}</p>}
                      {stop.type === "lodging" && <BookingInfo booking={stop.booking ?? {}} />}
                      {stop.reason && (
                        <p className="mt-2 text-[11px] text-primary/90 flex items-start gap-1 leading-relaxed">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" /><span>{stop.reason}</span>
                        </p>
                      )}
                      {stop.notes && <p className="mt-2 text-sm italic text-foreground/80">«{stop.notes}»</p>}
                      {stop.isPartner && (
                        <PartnerStopBlock
                          partnerId={stop.partnerId}
                          logoUrl={stop.partnerLogoUrl}
                          website={stop.partnerWebsite}
                          variant="roadbook"
                        />
                      )}
                    </li>
                  );
                })}
                {dayStops.length === 0 && <li className="pl-6 text-sm text-muted-foreground italic">{rb.emptyDay}</li>}
              </ol>
            </section>
          );
        })}

        {/* Lodging summary */}
        {(() => {
          const lodgingStops = tripStops.filter((s) => s.type === "lodging");
          if (lodgingStops.length === 0) return null;
          const total = lodgingStops.reduce((sum, s) => {
            const b = s.booking;
            if (!b?.pricePerNight) return sum;
            return sum + b.pricePerNight * (b.nights ?? 1);
          }, 0);
          return (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary"><Bed className="h-3.5 w-3.5" /> {rb.lodgingEyebrow}</p>
              <h2 className="mt-2 font-display text-2xl uppercase">{rb.lodgingTitle}</h2>
              <ul className="mt-4 space-y-3">
                {lodgingStops.map((s) => {
                  const b = s.booking;
                  const nights = b?.nights ?? 1;
                  const lineTotal = b?.pricePerNight ? b.pricePerNight * nights : null;
                  return (
                    <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/40 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{s.name}</p>
                          <BookingBadge status={b?.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {nights} {nights === 1 ? rb.nightSingular : rb.nightPlural}
                          {b?.checkinDate ? ` · ${rb.checkinPrefix} ${b.checkinDate}` : ""}
                          {b?.guests ? ` · ${b.guests} ${rb.guestsSuffix}` : ""}
                        </p>
                      </div>
                      {lineTotal != null && (
                        <span className="font-mono tabular-nums text-sm shrink-0">{lineTotal.toFixed(0)} kr</span>
                      )}
                    </li>
                  );
                })}
                {total > 0 && (
                  <li className="flex items-center justify-between pt-2 border-t border-border text-sm font-semibold">
                    <span>{rb.totalLodging}</span>
                    <span className="font-mono tabular-nums text-primary">{total.toFixed(0)} kr</span>
                  </li>
                )}
              </ul>
            </section>
          );
        })()}


        {/* Photo opportunities */}
        {memories.length > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary"><Camera className="h-3.5 w-3.5" /> {rb.photoEyebrow}</p>
            <h2 className="mt-2 font-display text-2xl uppercase">{rb.photoTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{rb.photoNote}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {memories.map((m) => (
                <div key={m.id} className="aspect-square rounded-xl border border-border bg-gradient-to-br from-surface to-surface-2 grid place-items-center relative overflow-hidden">
                  <span className="text-3xl">{m.emoji}</span>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-background/90 to-transparent">
                    <p className="text-[9px] uppercase tracking-wider truncate flex items-center gap-1"><ImageIcon className="h-2 w-2" />{m.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Partner tips */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">{rb.alongRoute}</p>
          <h2 className="mt-2 font-display text-2xl uppercase">{rb.localTips}</h2>
          <div className="mt-4 space-y-3">
            {partnerTips.map((tip) => {
              const badgeMap = {
                partner:  { label: rb.badgePartner,   cls: "border-primary/40 text-primary",                 Icon: Tag },
                promoted: { label: rb.badgePromoted, cls: "border-primary/40 text-primary bg-primary/10",   Icon: Star },
                local:    { label: rb.badgeLocal, cls: "border-border text-muted-foreground",          Icon: MapPin },
              } as const;
              const b = badgeMap[tip.badge]; const Bi = b.Icon;
              return (
                <div key={tip.id} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
                  <span className="h-10 w-10 rounded-lg bg-surface-2 grid place-items-center text-xl shrink-0">{tip.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{tip.name}</p>
                      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${b.cls}`}>
                        <Bi className="h-2.5 w-2.5" /> {b.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{tip.category} · {tip.location}</p>
                    <p className="mt-1 text-sm">{tip.blurb}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Personalized driving style */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-[11px] uppercase tracking-wider text-primary font-bold">{rb.drivingStyle}</p>
          <p className="mt-1.5 text-sm text-foreground/90">
            {rb.dailyDriving(prefs.maxDrivingHours, formatPauseLabel(prefs.pauseEveryMin))}
          </p>
          {(prefs.drivingFlags["no-highway"] || prefs.drivingFlags["no-ferry"]) && (
            <p className="mt-1.5 text-sm text-foreground/90">
              {rb.avoidLine([prefs.drivingFlags["no-highway"] && rb.highway, prefs.drivingFlags["no-ferry"] && rb.ferry].filter(Boolean).join(` ${rb.and} `))}
            </p>
          )}
          {prefs.stopInterests.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {rb.interestsFromProfile}: {prefs.stopInterests.map((tt) => stopMeta(tt).label).join(" · ")}
            </p>
          )}
        </section>

        {/* Completion summary */}
        {tracking.status === "completed" && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <p className="text-[11px] uppercase tracking-wider text-emerald-500 font-bold">{rb.tripCompleted}</p>
            <p className="mt-2 text-sm text-foreground/90">
              {typeof trip.actualDistanceKm === "number" && trip.actualDistanceKm > 0 ? (
                <>
                  {rb.droveLine(Math.round(trip.actualDistanceKm), trip.distanceKm)}
                  {(() => {
                    const diff = Math.round(trip.actualDistanceKm! - trip.distanceKm);
                    if (diff === 0) return rb.asPlanned;
                    return diff > 0 ? rb.longerThanPlanned(diff) : rb.shorterThanPlanned(Math.abs(diff));
                  })()}
                </>
              ) : (
                <>{rb.noActualDistance(trip.distanceKm)}</>
              )}
            </p>
          </section>
        )}

        {/* Practical info */}
        <section className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <p className="font-display uppercase text-foreground text-base">{rb.practicalInfo}</p>
          <ul className="mt-3 space-y-1.5">
            <li>· {rb.totalDistance(trip.distanceKm, tripDays.length, tripDays.length === 1 ? rb.daySingular : rb.dayPlural)}</li>
            <li>· {rb.drivingTime(trip.drivingTime)} <span className="text-[11px] text-muted-foreground/80">{rb.drivingTimeNote}</span></li>
            <li>· {rb.vehicleLine(vehicleDisplay, v.label, em ? em.label : "", s.label)}</li>
            {trip.energy === "electric" && <li>· {rb.electricNote}</li>}
            {trip.energy === "hybrid" && <li>· {rb.hybridNote}</li>}
            {trip.vehicle === "rv" && <li>· {rb.rvNote}</li>}
            {trip.vehicle === "motorcycle" && <li>· {rb.mcNote}</li>}
            {trip.startDate && <li>· {rb.departure(new Date(trip.startDate).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</li>}
            <li>· {rb.remember}</li>
            <li>· {rb.freeNote}</li>
          </ul>
        </section>



      </div>

      <div className="mt-12 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{rb.endOfRoadbook}</div>

      {/* Print-only footer block (per-page footer comes from @page) */}
      <div className="print-only" style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid #000", textAlign: "center", fontSize: "9pt" }}>
        <p style={{ fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>Veiglede</p>
        <p style={{ fontStyle: "italic", marginTop: "2px" }}>{rb.veigledeTagline}</p>
      </div>
    </div>
  );
}

function formatPauseLabel(min: number): string {
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return h === 1 ? "hver time" : h === 2 ? "annenhver time" : `hver ${h}. time`;
  }
  return `hvert ${min}. minutt`;
}
