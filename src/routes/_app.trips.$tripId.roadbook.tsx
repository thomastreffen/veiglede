import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useTripsStore, stopMeta, vehicleMeta, styleMeta,
  getPartnerTips, getPhotoMemories,
} from "@/lib/trips-store";
import { ShareTripModal } from "@/components/ShareTripModal";
import { DemoDebugPanel } from "@/components/DemoDebugPanel";
import { ArrowLeft, Clock, Share2, Download, Info, Camera, Sparkles, Image as ImageIcon, MapPin, Star, Tag } from "lucide-react";

export const Route = createFileRoute("/_app/trips/$tripId/roadbook")({
  head: () => ({ meta: [{ title: "Roadbook — Veiglede" }] }),
  component: Roadbook,
});

function Roadbook() {
  const { tripId } = Route.useParams();
  const { trips, days, stops } = useTripsStore();
  const [shareOpen, setShareOpen] = useState(false);
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return <div className="py-10">Tur ikke funnet.</div>;

  const tripDays = days.filter((d) => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  const tripStops = stops.filter((s) => tripDays.some((d) => d.id === s.dayId));
  const v = vehicleMeta(trip.vehicle);
  const s = styleMeta(trip.style);
  const partnerTips = getPartnerTips(trip);
  const memories = getPhotoMemories(trip, tripStops);

  const fmtDur = (m?: number) => !m ? "" : m >= 60 ? `${Math.floor(m/60)}t${m%60?` ${m%60}min`:""}` : `${m} min`;

  return (
    <div className="py-4">
      <DemoDebugPanel
        title="Roadbook debug"
        items={[
          { label: "Route", value: `/trips/${tripId}/roadbook` },
          { label: "Trip", value: trip.id },
          { label: "Days", value: tripDays.length },
          { label: "Stops", value: tripStops.length },
        ]}
      />

      <div className="flex items-center justify-between">
        <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Planlegger
        </Link>
        <div className="flex gap-2">
          <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary hover:text-primary"><Share2 className="h-3.5 w-3.5" /> Del</button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary"><Download className="h-3.5 w-3.5" /> Eksport</button>
        </div>
      </div>
      <ShareTripModal trip={trip} open={shareOpen} onOpenChange={setShareOpen} />

      <header className="mt-6 text-center max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Roadbook</p>
        <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase leading-[0.95]">{trip.title}</h1>
        <p className="mt-3 text-muted-foreground">{trip.origin} → {trip.destination}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{v.emoji} {v.label}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{s.emoji} {s.label}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs">{trip.distanceKm} km · {trip.drivingTime}</span>
        </div>
      </header>

      {trip.aiSummary && (
        <section className="mt-8 mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
            <Sparkles className="h-4 w-4" /> Hvorfor denne ruta
          </p>
          <p className="mt-2 text-sm leading-relaxed">{trip.aiSummary}</p>
        </section>
      )}

      <div className="mt-10 space-y-10 max-w-2xl mx-auto">
        {tripDays.map((day) => {
          const dayStops = stops.filter((s) => s.dayId === day.id).sort((a, b) => a.order - b.order);
          return (
            <section key={day.id} className="rounded-2xl border border-border bg-surface p-5 md:p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl uppercase text-primary">Dag {day.dayNumber}</span>
                {day.date && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{day.date}</span>}
              </div>
              <h2 className="mt-1 font-display text-2xl md:text-3xl uppercase">{day.title}</h2>
              {day.summary && <p className="mt-2 text-sm text-muted-foreground">{day.summary}</p>}

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
                      {stop.reason && (
                        <p className="mt-2 text-[11px] text-primary/90 flex items-start gap-1 leading-relaxed">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" /><span>{stop.reason}</span>
                        </p>
                      )}
                      {stop.notes && <p className="mt-2 text-sm italic text-foreground/80">«{stop.notes}»</p>}
                    </li>
                  );
                })}
                {dayStops.length === 0 && <li className="pl-6 text-sm text-muted-foreground italic">En åpen dag.</li>}
              </ol>
            </section>
          );
        })}

        {/* Photo opportunities */}
        {memories.length > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-primary"><Camera className="h-3.5 w-3.5" /> Fotomuligheter</p>
            <h2 className="mt-2 font-display text-2xl uppercase">Bilder fra denne ruta</h2>
            <p className="mt-1 text-xs text-muted-foreground">Senere kobles bildene dine automatisk hit basert på tid og posisjon.</p>
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
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Langs ruta</p>
          <h2 className="mt-2 font-display text-2xl uppercase">Lokale tips</h2>
          <div className="mt-4 space-y-3">
            {partnerTips.map((tip) => {
              const badgeMap = {
                partner:  { label: "Partner",   cls: "border-primary/40 text-primary",                 Icon: Tag },
                promoted: { label: "Promotert", cls: "border-primary/40 text-primary bg-primary/10",   Icon: Star },
                local:    { label: "Lokalt tips", cls: "border-border text-muted-foreground",          Icon: MapPin },
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

        {/* Practical info */}
        <section className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <p className="font-display uppercase text-foreground text-base">Praktisk info</p>
          <ul className="mt-3 space-y-1.5">
            <li>· Total distanse: {trip.distanceKm} km over {tripDays.length} {tripDays.length === 1 ? "dag" : "dager"}</li>
            <li>· Anslått kjøretid: {trip.drivingTime}</li>
            <li>· Kjøretøy: {v.label} · stil: {s.label}</li>
            {trip.startDate && <li>· Avreise: {new Date(trip.startDate).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</li>}
            <li>· Husk: offline kart, kontanter til bom, lader/strøm</li>
            <li>· Veiglede er gratis for deg som planlegger turen.</li>
          </ul>
        </section>

      </div>

      <div className="mt-12 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">— slutt på roadbook —</div>
    </div>
  );
}
