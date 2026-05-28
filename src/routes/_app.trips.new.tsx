import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { tripsApi, ROUTE_STYLES, type RouteStyle, vehicleMeta, styleMeta, type CoverKey, useTripsStore, stopMeta, buildAiSummary } from "@/lib/trips-store";
import { useVehicles, energyMeta, type Vehicle } from "@/lib/vehicles-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { TripMap } from "@/components/TripMap";
import { DemoDebugPanel } from "@/components/DemoDebugPanel";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Check, RotateCcw, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trips/new")({
  head: () => ({ meta: [{ title: "Ny tur — Veiglede" }] }),
  component: NewTripWizard,
});

type Step = 1 | 2 | 3 | 4;

function NewTripWizard() {
  const navigate = useNavigate();
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();
  const initialVehicle: Vehicle = vehicles.find((v) => v.id === defaultId) ?? vehicles[0];
  const [step, setStep] = useState<Step>(1);
  const [vehicleId, setVehicleId] = useState<string>(initialVehicle.id);
  const selectedVehicle: Vehicle = vehicles.find((v) => v.id === vehicleId) ?? initialVehicle;
  const [style, setStyle] = useState<RouteStyle>(selectedVehicle.defaultStyle);
  const [origin, setOrigin] = useState("Drammen");
  const [destination, setDestination] = useState("Hardangervidda");
  const [date, setDate] = useState("2026-06-07");
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);

  const pickVehicle = (v: Vehicle) => {
    setVehicleId(v.id);
    setStyle(v.defaultStyle);
  };


  const next = () => setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  const prev = () => {
    if (step === 4) {
      // discard preview
      if (tripId) tripsApi.deleteTrip(tripId);
      setTripId(null);
      setStep(3);
      return;
    }
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  };

  const generate = () => {
    if (!origin || !destination) return;
    setGenerating(true);
    setStep(4);
    setTimeout(() => {
      const s = styleMeta(style);
      const vt = selectedVehicle.type;
      const energy = selectedVehicle.energy;
      const distanceKm = 140 + Math.floor(Math.random() * 520);
      const hours = Math.floor(distanceKm / 60);
      const mins = Math.round(((distanceKm / 60) - hours) * 60);
      const ai = buildAiSummary({
        origin, destination, vehicle: vt, style,
        energy, vehicleName: selectedVehicle.name,
        userPrompt: aiPrompt || undefined,
        prefs: {
          drivingFlags: selectedVehicle.drivingFlags,
          stopInterests: selectedVehicle.stopInterests,
          maxDrivingHours: prefs.maxDrivingHours,
          pauseEveryMin: prefs.pauseEveryMin,
        },
      });
      const trip = tripsApi.createTrip({
        title: `${origin} → ${destination}`,
        subtitle: `${s.label} med ${selectedVehicle.name}`,
        region: "Norge",
        origin, destination, startDate: date,
        vehicle: vt, vehicleId: selectedVehicle.id, vehicleName: selectedVehicle.name, energy,
        style,
        distanceKm, drivingTime: `${hours}t ${mins}min`,
        cover: pickCover(style),
        aiSummary: ai,
      });
      setTripId(trip.id);
      setGenerating(false);
    }, 1400);
  };

  const regenerate = () => {
    if (tripId) tripsApi.deleteTrip(tripId);
    setTripId(null);
    generate();
  };

  return (
    <div className="py-4 md:py-8 max-w-2xl mx-auto pb-32 md:pb-12">
      <DemoDebugPanel
        title="Wizard debug"
        items={[
          { label: "Route", value: "/trips/new" },
          { label: "Step", value: `${step}/4` },
          { label: "Trip id", value: tripId ?? "ikke opprettet" },
        ]}
      />

      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button onClick={prev} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tilbake
          </button>
        ) : (
          <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Avbryt
          </Link>
        )}
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1.5 w-8 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary">Steg {step} av 4 · {["Kjøretøy", "Stil", "Rute", "Forslag"][step - 1]}</p>

      {step === 1 && (
        <>
          <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase">Hva kjører du?</h1>
          <p className="mt-3 text-muted-foreground">Velg kjøretøyet for denne turen. Stoppene tilpasses bil, drivstoff og dine preferanser.</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map((v) => {
              const tm = vehicleMeta(v.type);
              const em = energyMeta(v.energy);
              const active = v.id === vehicleId;
              return (
                <button key={v.id} onClick={() => pickVehicle(v)}
                  className={cn(
                    "rounded-2xl border-2 bg-surface p-4 text-left transition-all flex gap-3 items-start",
                    active ? "border-primary bg-gradient-to-b from-primary/10 to-transparent" : "border-border hover:border-border/80"
                  )}>
                  <div className="h-14 w-14 rounded-xl border border-border bg-surface-2 overflow-hidden grid place-items-center text-2xl shrink-0">
                    {v.photo ? <img src={v.photo} alt={v.name} className="h-full w-full object-cover" /> : <span>{tm.emoji}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base uppercase leading-tight">{v.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{tm.label} · {em.emoji} {em.label}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-primary">{styleMeta(v.defaultStyle).label}</p>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>
          <Link to="/settings" className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
            <span className="underline">Administrer kjøretøy i Profil</span>
          </Link>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase">Hvordan vil du kjøre?</h1>
          <p className="mt-3 text-muted-foreground">Velg en stil — vi bygger ruta rundt opplevelsen, ikke bare avstanden.</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {ROUTE_STYLES.map((s) => (
              <button key={s.value} onClick={() => setStyle(s.value)}
                className={cn(
                  "rounded-2xl border-2 bg-surface p-4 text-left transition-all",
                  style === s.value
                    ? "border-primary bg-gradient-to-b from-primary/10 to-transparent"
                    : "border-border"
                )}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="font-display uppercase text-base">{s.label}</span>
                  {style === s.value && <span className="ml-auto text-primary">✓</span>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{s.sub}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase">Hvor skal du?</h1>
          <p className="mt-3 text-muted-foreground">Fra, til og dato — vi tar oss av resten.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip>{vehicleMeta(selectedVehicle.type).emoji} {selectedVehicle.name}</Chip>
            <Chip>{energyMeta(selectedVehicle.energy).emoji} {energyMeta(selectedVehicle.energy).label}</Chip>
            <Chip>{styleMeta(style).emoji} {styleMeta(style).label}</Chip>
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Fra">
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base outline-none focus:border-primary" />
            </Field>
            <Field label="Til">
              <input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base outline-none focus:border-primary" />
            </Field>
            <Field label="Dato">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base outline-none focus:border-primary" />
            </Field>

            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
                  <Sparkles className="h-4 w-4" /> Planlegg med AI
                </p>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">valgfritt</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Beskriv turen, så hjelper AI-ko-piloten med stopp og rute.</p>
              <input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="F.eks: MC-tur, 5 timer, svingete veier"
                className="mt-3 w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/60" />
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <PreviewStep generating={generating} tripId={tripId} onRegenerate={regenerate} onOpen={() => tripId && navigate({ to: "/trips/$tripId", params: { tripId } })} />
      )}

      {step !== 4 && (
        <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
          <button
            onClick={step === 3 ? generate : next}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
          >
            {step === 3 ? (<><Sparkles className="h-5 w-5" /> Generer rute</>) : (<>Fortsett <ArrowRight className="h-5 w-5" strokeWidth={3} /></>)}
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewStep({
  generating, tripId, onRegenerate, onOpen,
}: { generating: boolean; tripId: string | null; onRegenerate: () => void; onOpen: () => void }) {
  const { trips, days, stops } = useTripsStore();
  const trip = tripId ? trips.find((t) => t.id === tripId) : null;

  if (generating || !trip) {
    return (
      <div className="mt-10 rounded-3xl border border-primary/30 bg-primary/5 p-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-5 font-display text-2xl uppercase">AI tegner ruta di</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">Vurderer landskap, lys og naturlige pauser. Bare et øyeblikk.</p>
        <div className="mt-6 flex justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  const tripDays = days.filter((d) => d.tripId === trip.id).sort((a, b) => a.dayNumber - b.dayNumber);
  const tripStops = stops.filter((s) => tripDays.some((d) => d.id === s.dayId));

  return (
    <div className="mt-6 space-y-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
        <Check className="h-3.5 w-3.5" /> Ruta er klar
      </div>
      <h1 className="font-display text-4xl md:text-5xl uppercase leading-[0.95]">{trip.title}</h1>
      <p className="text-sm text-muted-foreground">Et utgangspunkt — finpuss stopp og dager i planleggeren.</p>

      <TripMap trip={trip} days={tripDays} stops={tripStops} compact height="h-48" />

      <div className="grid grid-cols-3 gap-3">
        <PreviewStat label="Distanse" value={`${trip.distanceKm} km`} />
        <PreviewStat label="Kjøretid" value={trip.drivingTime} />
        <PreviewStat label="Dager" value={String(tripDays.length)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <PreviewStat label="Kjøretøy" value={trip.vehicleName ?? vehicleMeta(trip.vehicle).label} />
        <PreviewStat label="Rutestil" value={styleMeta(trip.style).label} />
        <PreviewStat label="Stopp" value={String(tripStops.length)} />
      </div>

      {trip.aiSummary && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
            <Sparkles className="h-4 w-4" /> AI ko-pilot
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Foreslåtte stopp · {tripStops.length}</p>
        <ul className="space-y-2">
          {tripStops.slice(0, 8).map((s) => {
            const m = stopMeta(s.type);
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="h-8 w-8 rounded-lg bg-surface-2 grid place-items-center text-base">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.label}{s.estimatedTime ? ` · ${s.estimatedTime}` : ""}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-24 md:bottom-0 md:static flex gap-3 pt-2">
        <button onClick={onRegenerate} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-4 text-sm font-medium hover:border-primary">
          <RotateCcw className="h-4 w-4" /> Ny variant
        </button>
        <button onClick={onOpen} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20">
          <BookOpen className="h-5 w-5" /> Åpne planlegger
        </button>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">{children}</span>;
}
function pickCover(s: RouteStyle): CoverKey {
  switch (s) {
    case "scenic": return "fjord";
    case "curvy": return "mountain";
    case "photo": return "lofoten";
    case "tourist": return "coast";
    case "cruise": return "valley";
    default: return "forest";
  }
}
