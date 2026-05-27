import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { tripsApi, VEHICLES, ROUTE_STYLES, type VehicleType, type RouteStyle, vehicleMeta, styleMeta, type CoverKey } from "@/lib/trips-store";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trips/new")({
  head: () => ({ meta: [{ title: "Ny tur — Veiglede" }] }),
  component: NewTripWizard,
});

function NewTripWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vehicle, setVehicle] = useState<VehicleType>("motorcycle");
  const [style, setStyle] = useState<RouteStyle>("curvy");
  const [origin, setOrigin] = useState("Drammen");
  const [destination, setDestination] = useState("Hardangervidda");
  const [date, setDate] = useState("2026-06-07");
  const [aiPrompt, setAiPrompt] = useState("");

  const next = () => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  const prev = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const create = () => {
    if (!origin || !destination) return;
    const v = vehicleMeta(vehicle);
    const s = styleMeta(style);
    const distanceKm = 120 + Math.floor(Math.random() * 400);
    const hours = Math.floor(distanceKm / 60);
    const mins = Math.round(((distanceKm / 60) - hours) * 60);
    const ai = aiPrompt
      ? `Basert på «${aiPrompt}» foreslår AI-ko-piloten en rute med fokus på ${s.label.toLowerCase()} for ${v.label.toLowerCase()}.`
      : `Foreslått ${s.label.toLowerCase()} for ${v.label.toLowerCase()} fra ${origin} til ${destination}.`;
    const trip = tripsApi.createTrip({
      title: `${origin} → ${destination}`,
      subtitle: `${s.label} på ${v.label.toLowerCase()}`,
      region: "Norge",
      origin, destination, startDate: date,
      vehicle, style,
      distanceKm, drivingTime: `${hours}t ${mins}min`,
      stopsCount: 4, cover: pickCover(style),
      aiSummary: ai,
    });
    navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
  };

  return (
    <div className="py-4 md:py-8 max-w-2xl mx-auto">
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
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1.5 w-10 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary">Steg {step} av 3</p>

      {step === 1 && (
        <>
          <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase">Velg kjøretøy</h1>
          <p className="mt-3 text-muted-foreground">Vi tilpasser ruten etter hva du kjører.</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {VEHICLES.map((v) => (
              <button key={v.value} onClick={() => setVehicle(v.value)}
                className={cn(
                  "rounded-2xl border-2 bg-surface p-5 text-left transition-all",
                  vehicle === v.value
                    ? "border-primary bg-gradient-to-b from-primary/10 to-transparent"
                    : "border-border hover:border-border/80"
                )}>
                <div className="text-5xl">{v.emoji}</div>
                <p className="mt-4 font-display text-xl uppercase">{v.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v.sub}</p>
                {vehicle === v.value && <p className="mt-3 text-xs font-semibold text-primary">✓ Valgt</p>}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase">Velg kjørestil</h1>
          <p className="mt-3 text-muted-foreground">Hva slags opplevelse ønsker du?</p>
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
          <h1 className="mt-3 font-display text-5xl md:text-6xl uppercase">Velg rute</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip>{vehicleMeta(vehicle).emoji} {vehicleMeta(vehicle).label}</Chip>
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
                placeholder="F.eks: MC-tur fra Drammen, 5 timer, svingete veier"
                className="mt-3 w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/60" />
            </div>
          </div>
        </>
      )}

      <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
        <button
          onClick={step === 3 ? create : next}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
        >
          {step === 3 ? "Generer rute" : "Fortsett"} <ArrowRight className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
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
