import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { tripsApi, ROUTE_STYLES, type RouteStyle, vehicleMeta, styleMeta, type CoverKey, useTripsStore, stopMeta, buildAiSummary } from "@/lib/trips-store";
import { useVehicles, energyMeta, type Vehicle } from "@/lib/vehicles-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { TripMap } from "@/components/TripMap";
import { DemoDebugPanel, useDebugMode } from "@/components/DemoDebugPanel";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import type { ResolvedPlace } from "@/lib/places/geocoder";
import { manualPlace } from "@/lib/places/geocoder";
import { getRoute, type RouteResult } from "@/lib/routing";
import { TripTimeBudget } from "@/components/TripTimeBudget";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Check, RotateCcw, BookOpen, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/trips/new")({
  head: () => ({ meta: [{ title: "Ny tur — Veiglede" }] }),
  validateSearch: (s: Record<string, unknown>): { restoreDraft?: "force" | "fresh"; ts?: string } => {
    const raw = s.restoreDraft;
    const v = typeof raw === "boolean" ? String(raw) : typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
    const tsRaw = s.ts;
    const ts = tsRaw == null ? undefined : String(tsRaw);
    if (v === undefined || v === "") return {};
    const FORCE = new Set(["1", "true", "force", "yes"]);
    const FRESH = new Set(["0", "false", "fresh", "no"]);
    if (FORCE.has(v)) return { restoreDraft: "force", ts };
    if (FRESH.has(v)) return { restoreDraft: "fresh", ts };
    // Unknown values: treat as fresh to avoid hijacking with stale drafts.
    return { restoreDraft: "fresh", ts };
  },
  component: NewTripWizard,
});

type Step = 1 | 2 | 3 | 4;

const DRAFT_KEY = "veiglede.newTrip.draft.v1";
// Session marker: present means "we're inside an active wizard session in this tab".
// Persists across hard refresh (sessionStorage) but NOT across new tabs/windows,
// and we clear it on SPA navigation away from the wizard.
const SESSION_KEY = "veiglede.newTrip.session.v1";

interface Draft {
  step: Step;
  vehicleId?: string;
  style?: RouteStyle;
  origin?: string;
  destination?: string;
  fromPlace?: ResolvedPlace | null;
  toPlace?: ResolvedPlace | null;
  date?: string;
  aiPrompt?: string;
  tripId?: string | null;
}

interface WizardSnapshot {
  step: Step;
  vehicleId: string;
  style: RouteStyle;
  origin: string;
  destination: string;
  fromPlace: ResolvedPlace | null;
  toPlace: ResolvedPlace | null;
  date: string;
  aiPrompt: string;
  tripId: string | null;
}

const DEFAULT_DATE = "2026-06-07";

function loadDraft(): Draft | null {
  if (typeof localStorage === "undefined") return null;
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) as Draft : null; } catch { return null; }
}
function saveDraft(d: Draft) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
function clearDraft() {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
function hasActiveSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
function markSessionActive() {
  if (typeof sessionStorage === "undefined") return;
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
}
function clearSession() {
  if (typeof sessionStorage === "undefined") return;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function createFreshSnapshot(initialVehicle: Vehicle, defaultStyle?: RouteStyle): WizardSnapshot {
  return {
    step: 1,
    vehicleId: initialVehicle.id,
    style: defaultStyle ?? initialVehicle.defaultStyle,
    origin: "",
    destination: "",
    fromPlace: null,
    toPlace: null,
    date: DEFAULT_DATE,
    aiPrompt: "",
    tripId: null,
  };
}

function createRestoredSnapshot({
  draft,
  vehicles,
  initialVehicle,
  trips,
}: {
  draft: Draft | null;
  vehicles: Vehicle[];
  initialVehicle: Vehicle;
  trips: ReturnType<typeof useTripsStore>["trips"];
}): WizardSnapshot {
  const vehicleId = draft?.vehicleId && vehicles.some((vehicle) => vehicle.id === draft.vehicleId)
    ? draft.vehicleId
    : initialVehicle.id;
  const vehicle = vehicles.find((candidate) => candidate.id === vehicleId) ?? initialVehicle;
  const tripId = draft?.tripId && trips.some((trip) => trip.id === draft.tripId) ? draft.tripId : null;

  return {
    step: tripId ? 4 : (draft?.step ?? 1),
    vehicleId,
    style: draft?.style ?? vehicle.defaultStyle,
    origin: draft?.origin ?? "",
    destination: draft?.destination ?? "",
    fromPlace: draft?.fromPlace ?? null,
    toPlace: draft?.toPlace ?? null,
    date: draft?.date ?? DEFAULT_DATE,
    aiPrompt: draft?.aiPrompt ?? "",
    tripId,
  };
}

function NewTripWizard() {
  const navigate = useNavigate();
  const { restoreDraft: restoreParam, ts } = Route.useSearch();
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();
  const initialVehicle: Vehicle = vehicles.find((v) => v.id === defaultId) ?? vehicles[0];
  const { trips } = useTripsStore();

  const resolveSnapshot = (): WizardSnapshot => {
    if (typeof window === "undefined") {
      return createFreshSnapshot(initialVehicle, prefs.defaultStyle);
    }

    if (restoreParam === "fresh") {
      clearDraft();
      clearSession();
      return createFreshSnapshot(initialVehicle, prefs.defaultStyle);
    }

    const shouldRestore = restoreParam === "force" || hasActiveSession();
    if (!shouldRestore) {
      clearDraft();
      clearSession();
      return createFreshSnapshot(initialVehicle, prefs.defaultStyle);
    }

    return createRestoredSnapshot({
      draft: loadDraft(),
      vehicles,
      initialVehicle,
      trips,
    });
  };

  const initialSnapshot = resolveSnapshot();

  const [step, setStep] = useState<Step>(initialSnapshot.step);
  const [vehicleId, setVehicleId] = useState<string>(initialSnapshot.vehicleId);
  const [style, setStyle] = useState<RouteStyle>(initialSnapshot.style);
  const [origin, setOrigin] = useState(initialSnapshot.origin);
  const [destination, setDestination] = useState(initialSnapshot.destination);
  const [fromPlace, setFromPlace] = useState<ResolvedPlace | null>(initialSnapshot.fromPlace);
  const [toPlace, setToPlace] = useState<ResolvedPlace | null>(initialSnapshot.toPlace);
  const [date, setDate] = useState(initialSnapshot.date);
  const [aiPrompt, setAiPrompt] = useState(initialSnapshot.aiPrompt);
  const [generating, setGenerating] = useState(false);
  const [tripId, setTripId] = useState<string | null>(initialSnapshot.tripId);
  const selectedVehicle: Vehicle = vehicles.find((v) => v.id === vehicleId) ?? initialVehicle;
  const [lastRoute, setLastRoute] = useState<RouteResult | null>(null);
  const debug = useDebugMode();

  useEffect(() => {
    const snapshot = resolveSnapshot();
    setStep(snapshot.step);
    setVehicleId(snapshot.vehicleId);
    setStyle(snapshot.style);
    setOrigin(snapshot.origin);
    setDestination(snapshot.destination);
    setFromPlace(snapshot.fromPlace);
    setToPlace(snapshot.toPlace);
    setDate(snapshot.date);
    setAiPrompt(snapshot.aiPrompt);
    setGenerating(false);
    setTripId(snapshot.tripId);

    if (restoreParam === "fresh") {
      navigate({ to: "/trips/new", replace: true });
    }
  }, [restoreParam, ts]);

  // Mark this tab as having an active wizard session, and clear that marker
  // on SPA navigation away. A hard refresh tears down React without running
  // the cleanup, so the marker survives the refresh — exactly what we want.
  useEffect(() => {
    markSessionActive();
    return () => { clearSession(); };
  }, []);

  // Persist wizard state so refresh on result/step doesn't lose progress.
  useEffect(() => {
    saveDraft({ step, vehicleId, style, origin, destination, fromPlace, toPlace, date, aiPrompt, tripId });
  }, [step, vehicleId, style, origin, destination, fromPlace, toPlace, date, aiPrompt, tripId]);



  const pickVehicle = (v: Vehicle) => {
    setVehicleId(v.id);
    setStyle(v.defaultStyle);
  };


  const next = () => setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  const prev = () => {
    if (step === 4) {
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
    void (async () => {
      const s = styleMeta(style);
      const vt = selectedVehicle.type;
      const energy = selectedVehicle.energy;
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
      // Prefer selected place coords; fall back to local demo lookup from text.
      const fromResolved = fromPlace ?? manualPlace(origin);
      const toResolved = toPlace ?? manualPlace(destination);

      // Try real routing when we have coordinates for both endpoints.
      let route: RouteResult | null = null;
      if (fromResolved && toResolved) {
        // Honor user profile + per-vehicle flags. Either source can request to
        // avoid motorways or ferries; OR the values so neither is silently lost.
        const vehicleFlags = selectedVehicle.drivingFlags ?? {};
        const userFlags = prefs.drivingFlags ?? {};
        const styleImpliesNoHighway = style === "scenic" || style === "curvy" || style === "tourist";
        const avoidHighways = !!(userFlags["no-highway"] || vehicleFlags["no-highway"] || styleImpliesNoHighway);
        const avoidFerries = !!(userFlags["no-ferry"] || vehicleFlags["no-ferry"]);
        route = await getRoute({
          origin: { lat: fromResolved.lat, lng: fromResolved.lng },
          destination: { lat: toResolved.lat, lng: toResolved.lng },
          vehicleType: vt,
          routeStyle: style,
          avoidHighways,
          avoidFerries,
        });
        setLastRoute(route);
      } else {
        setLastRoute(null);
      }

      const distanceKm = route?.distanceKm ?? 140 + Math.floor(Math.random() * 520);
      const hours = Math.floor(distanceKm / 60);
      const mins = Math.round(((distanceKm / 60) - hours) * 60);
      const drivingTime = route?.durationMin
        ? `${Math.floor(route.durationMin / 60)}t ${route.durationMin % 60}min`
        : `${hours}t ${mins}min`;

      const trip = tripsApi.createTrip({
        title: `${origin} → ${destination}`,
        subtitle: `${s.label} med ${selectedVehicle.name}`,
        region: "Norge",
        origin, destination, startDate: date,
        vehicle: vt, vehicleId: selectedVehicle.id, vehicleName: selectedVehicle.name, energy,
        style,
        distanceKm, drivingTime,
        cover: pickCover(style),
        aiSummary: ai,
        originLoc: fromResolved ? { lat: fromResolved.lat, lng: fromResolved.lng } : undefined,
        destinationLoc: toResolved ? { lat: toResolved.lat, lng: toResolved.lng } : undefined,
        routeGeometry: route?.geometry,
        routeDistanceKm: route?.distanceKm,
        routeDurationMin: route?.durationMin,
        routeProvider: route?.provider,
        routeProfile: route?.profile,
        routeAvoidHighways: route?.avoidOptions?.highways,
        routeAvoidFerries: route?.avoidOptions?.ferries,
        routeRawDistanceMeters: route?.rawDistanceMeters,
        routeRawDurationSeconds: route?.rawDurationSeconds,
        routeFerryDistanceKm: route?.ferryDistanceKm,
        routeFerryDurationMin: route?.ferryDurationMin,
        routeFallbackEstimateMin: route?.fallbackEstimateMin,
      });
      // Snapshot a trip time breakdown using the freshly-seeded stops.
      try {
        const { computeTimeBreakdown } = await import("@/lib/trip-time");
        const bundle = tripsApi.getTripBundle(trip.id);
        if (bundle.trip) {
          const breakdown = computeTimeBreakdown(bundle.trip, bundle.days, bundle.stops);
          tripsApi.updateTrip(trip.id, { timeBreakdown: breakdown });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.debug("[wizard] timeBreakdown snapshot failed", err);
      }
      setTripId(trip.id);
      setGenerating(false);
    })();
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
          { label: "Routing", value: lastRoute?.provider ?? "—" },
          { label: "Profile", value: lastRoute?.profile ?? "—" },
          { label: "Avoid", value: lastRoute?.avoidOptions ? `hw=${lastRoute.avoidOptions.highways} fer=${lastRoute.avoidOptions.ferries}` : "—" },
          { label: "Geometry pts", value: lastRoute?.geometry.length ?? 0 },
          { label: "ORS raw dist", value: lastRoute?.rawDistanceMeters != null ? `${lastRoute.rawDistanceMeters} m` : "—" },
          { label: "ORS raw dur", value: lastRoute?.rawDurationSeconds != null ? `${lastRoute.rawDurationSeconds} s` : "—" },
          { label: "Normalized", value: lastRoute ? `${lastRoute.distanceKm} km · ${lastRoute.durationMin} min` : "—" },
          { label: "Ferry (ORS)", value: lastRoute?.ferryDurationMin ? `${lastRoute.ferryDurationMin} min · ${lastRoute.ferryDistanceKm} km` : "none/unknown" },
          { label: "Fallback est", value: lastRoute?.fallbackEstimateMin != null ? `${lastRoute.fallbackEstimateKm} km · ${lastRoute.fallbackEstimateMin} min` : "—" },
          { label: "Δ vs fallback", value: lastRoute?.fallbackEstimateMin != null && lastRoute.provider === "ors" ? `${lastRoute.durationMin - lastRoute.fallbackEstimateMin} min` : "—" },
          { label: "Driving src", value: lastRoute?.durationMin != null && lastRoute.provider === "ors" ? "ors" : "estimated" },
          { label: "Stop sum (min)", value: tripId ? (tripsApi.getTripBundle(tripId).stops.reduce((a, s) => a + (s.durationMin ?? 0), 0)) : "—" },
          { label: "Routing warn", value: lastRoute?.warnings?.join(",") ?? "—" },
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
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <PlaceAutocomplete
                    value={origin}
                    onTextChange={setOrigin}
                    selected={fromPlace}
                    onSelect={setFromPlace}
                    ariaLabel="Fra"
                  />
                </div>
                <UseMyLocationButton
                  onResolved={(name, place) => { setOrigin(name); setFromPlace(place); }}
                />
              </div>
            </Field>
            <Field label="Til">
              <PlaceAutocomplete
                value={destination}
                onTextChange={setDestination}
                selected={toPlace}
                onSelect={setToPlace}
                ariaLabel="Til"
              />
            </Field>
            <Field label="Dato">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base outline-none focus:border-primary" />
            </Field>

            {debug && (
              <div className="rounded-xl border border-primary/40 bg-background/60 p-3 text-[11px] space-y-1 font-mono">
                <p className="uppercase tracking-wider text-primary not-italic">Place debug</p>
                <p>from: {fromPlace ? `${fromPlace.source} · ${fromPlace.lat.toFixed(4)}, ${fromPlace.lng.toFixed(4)}` : "(none)"}</p>
                <p>to:   {toPlace ? `${toPlace.source} · ${toPlace.lat.toFixed(4)}, ${toPlace.lng.toFixed(4)}` : "(none)"}</p>
                <p>provider: {fromPlace?.source ?? "—"} / {toPlace?.source ?? "—"}</p>
              </div>
            )}


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
        <PreviewStep
          generating={generating}
          tripId={tripId}
          onRegenerate={regenerate}
          onOpen={() => {
            if (!tripId) return;
            clearDraft();
            clearSession();
            navigate({ to: "/trips/$tripId", params: { tripId } });
          }}
        />
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
  const navigate = useNavigate();
  const { trips, days, stops } = useTripsStore();
  const prefs = useDriverPrefs();
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
  const durationMin = trip.routeDurationMin ?? 0;
  const maxMin = prefs.maxDrivingHours * 60;
  const isLongLeg = durationMin > 0 && durationMin > maxMin;

  const goToPlanner = () => {
    if (!tripId) return;
    onOpen();
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
        <Check className="h-3.5 w-3.5" /> Rutekladd klar
      </div>
      <h1 className="font-display text-4xl md:text-5xl uppercase leading-[0.95]">{trip.title}</h1>
      <p className="text-sm text-muted-foreground">Dette er en kladd av første etappe — du bestemmer hvordan turen skal bygges videre.</p>

      <TripMap trip={trip} days={tripDays} stops={tripStops} compact height="h-64 md:h-[420px]" />

      <div className="grid grid-cols-3 gap-3">
        <PreviewStat label="Distanse" value={`${trip.distanceKm} km`} />
        <PreviewStat label="Beregnet kjøretid" value={trip.drivingTime} />
        <PreviewStat label="Kjøretøy" value={trip.vehicleName ?? vehicleMeta(trip.vehicle).label} />
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Beregnet av rutemotor. Kan avvike fra Google Maps, trafikk, ferge og lokale forhold.
      </p>

      {isLongLeg && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-200">Denne etappen er lang ({trip.drivingTime}).</p>
          <p className="mt-1 text-xs text-amber-100/80">
            Lengre enn dine {prefs.maxDrivingHours} timer kjøring per dag. Vil du dele den opp?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (!tripId) return;
                tripsApi.splitIntoDays(tripId, 2);
                tripsApi.addOvernight(tripId);
                goToPlanner();
              }}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-950 hover:brightness-110"
            >
              Ja, foreslå overnatting
            </button>
            <button
              onClick={goToPlanner}
              className="rounded-full border border-amber-500/40 bg-background/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-100 hover:bg-amber-500/20"
            >
              Nei, behold som én dag
            </button>
            <button
              onClick={goToPlanner}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:border-primary"
            >
              Velg selv senere
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary font-bold">Neste steg</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ActionBtn
            onClick={() => { if (!tripId) return; goToPlanner(); }}
            label="Kjør som én dag"
            sub="Behold som én etappe og åpne planlegger"
          />
          <ActionBtn
            onClick={() => { if (!tripId) return; tripsApi.splitIntoDays(tripId, 2); goToPlanner(); }}
            label="Del opp i flere dager"
            sub="Legger til en ny tom dag"
          />
          <ActionBtn
            onClick={() => { if (!tripId) return; tripsApi.addOvernight(tripId); goToPlanner(); }}
            label="Legg til overnatting"
            sub={`Overnatting i ${trip.destination}`}
          />
          <ActionBtn
            onClick={goToPlanner}
            label="Legg til neste destinasjon"
            sub="Bygg ruta videre fra planleggeren"
          />
          <ActionBtn
            onClick={goToPlanner}
            label="Legg til stopp langs ruta"
            sub="Se forslag og velg plassering"
          />
          <ActionBtn
            onClick={goToPlanner}
            label="Åpne roadbook"
            sub="Detaljert dag-for-dag oversikt"
          />
        </div>
      </div>

      {trip.aiSummary && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
            <Sparkles className="h-4 w-4" /> AI ko-pilot
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{trip.aiSummary}</p>
        </div>
      )}

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

function ActionBtn({ onClick, label, sub }: { onClick: () => void; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface px-4 py-3 text-left hover:border-primary transition-colors"
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </button>
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
