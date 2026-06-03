import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Sparkles, Plus, X, Minus, Check } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useVehicles, energyTypeToSource, energyMeta, type Vehicle } from "@/lib/vehicles-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { manualPlace, type ResolvedPlace } from "@/lib/places/geocoder";
import {
  tripsApi, ROUTE_STYLES, styleMeta, vehicleMeta, buildAiSummary,
  type RouteStyle, type CoverKey, type StopType, looksLikeLodging,
} from "@/lib/trips-store";
import { getRoute, type RouteResult } from "@/lib/routing";
import { fetchRoutePartnersFn } from "@/lib/partners.functions";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { generateAiTripPlanFn, type AiPlanResult } from "@/lib/trip-ai-plan.functions";

type Step = 1 | 2 | 3 | 4;

interface WaypointRow {
  key: string;
  text: string;
  place: ResolvedPlace | null;
}

function getDefaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const uid = () => Math.random().toString(36).slice(2, 10);
const newWaypoint = (): WaypointRow => ({ key: uid(), text: "", place: null });

function safeStopName(raw: string | null | undefined, type: StopType): string {
  const v = (raw ?? "").trim();
  if (!v || /^ingen$/i.test(v)) {
    if (type === "lodging") return "Overnatting";
    if (type === "food") return "Matpause";
    if (type === "viewpoint") return "Utsiktspunkt";
    return "Stopp";
  }
  return v;
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

function isInNorway(p: ResolvedPlace | null): boolean {
  if (!p) return false;
  return p.lat >= 56 && p.lat <= 72 && p.lng >= 3 && p.lng <= 32;
}

export function AiWizard({ onBack }: { onBack: () => void }) {
  const t = useT();
  const w = t.wizard;
  const nt = t.app.newTrip;
  const navigate = useNavigate();
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();
  const defaultVehicle: Vehicle | undefined = vehicles.find((v) => v.id === defaultId) ?? vehicles[0];
  const generateAiPlan = useServerFn(generateAiTripPlanFn);

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [fromPlace, setFromPlace] = useState<ResolvedPlace | null>(null);
  const [toPlace, setToPlace] = useState<ResolvedPlace | null>(null);
  const [date, setDate] = useState(() => getDefaultDate());
  const [days, setDays] = useState<number>(1);
  const [roundTrip, setRoundTrip] = useState<boolean>(true);

  // Step 2
  const [waypoints, setWaypoints] = useState<WaypointRow[]>([]);

  // Step 3
  const [vehicleId, setVehicleId] = useState<string | undefined>(defaultVehicle?.id);
  const [style, setStyle] = useState<RouteStyle>(defaultVehicle?.defaultStyle ?? "scenic");
  const [maxHours, setMaxHours] = useState<number>(prefs.maxDrivingHours ?? 6);
  const [avoidHighway, setAvoidHighway] = useState<boolean>(
    !!(prefs.drivingFlags?.["no-highway"] || defaultVehicle?.drivingFlags?.["no-highway"]),
  );

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? defaultVehicle;

  const canNextStep1 = origin.trim().length > 0 && destination.trim().length > 0;

  const updateWp = (key: string, patch: Partial<WaypointRow>) =>
    setWaypoints((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeWp = (key: string) => setWaypoints((rs) => rs.filter((r) => r.key !== key));
  const addWp = () => setWaypoints((rs) => rs.length >= 5 ? rs : [...rs, newWaypoint()]);
  const addSuggestion = (name: string) => {
    if (waypoints.length >= 5) return;
    if (waypoints.some((r) => r.text.toLowerCase() === name.toLowerCase())) return;
    setWaypoints((rs) => [...rs, { key: uid(), text: name, place: null }]);
  };

  const norwayRoute = isInNorway(fromPlace) && isInNorway(toPlace);
  const suggestions = norwayRoute
    ? ["Trollstigen", "Atlanterhavsveien", "Jotunheimen"]
    : [];

  const ensurePlace = async (text: string, place: ResolvedPlace | null): Promise<ResolvedPlace | null> => {
    if (place) return place;
    const fallback = manualPlace(text);
    if (fallback) return fallback;
    try {
      const { searchPlaces, resolveGooglePlace } = await import("@/lib/places/geocoder");
      const res = await searchPlaces(text.trim(), new AbortController().signal);
      const first = res.results[0];
      if (!first) return null;
      if (first.needsDetails) return await resolveGooglePlace(first);
      return first;
    } catch { return null; }
  };

  const startGenerate = () => {
    if (!selectedVehicle) { toast.error(w.generate.failed); return; }
    setStep(4);
  };

  return (
    <div className="py-4 md:py-8 max-w-2xl mx-auto pb-32 md:pb-12">
      {step !== 4 && (
        <div className="flex items-center justify-between">
          <button
            onClick={step === 1 ? onBack : () => setStep((s) => (s - 1) as Step)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 1 ? w.common.backToMode : w.common.back}
          </button>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 w-8 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary">{w.ai.step1Eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{w.ai.step1Title}</h1>
          <p className="mt-3 text-muted-foreground">{w.ai.step1Body}</p>

          <div className="mt-6 space-y-5">
            <Field label={nt.from}>
              <PlaceAutocomplete value={origin} onTextChange={setOrigin} selected={fromPlace} onSelect={setFromPlace} ariaLabel={nt.from} />
            </Field>
            <Field label={nt.to}>
              <PlaceAutocomplete value={destination} onTextChange={setDestination} selected={toPlace} onSelect={setToPlace} ariaLabel={nt.to} />
            </Field>
            <Field label={nt.date}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 text-base outline-none focus:border-primary"
              />
              {date && date < todayIso() && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Datoen er i fortiden — er du sikker?
                </p>
              )}
            </Field>
            <Field label={w.ai.daysLabel}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDays((d) => Math.max(1, d - 1))}
                  className="h-12 w-12 grid place-items-center rounded-xl border border-border bg-surface hover:border-primary"
                  aria-label="-1"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex-1 text-center">
                  <p className="font-display text-4xl">{days}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{days === 1 ? w.ai.dayUnitSingular : w.ai.dayUnitPlural}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDays((d) => Math.min(21, d + 1))}
                  className="h-12 w-12 grid place-items-center rounded-xl border border-border bg-surface hover:border-primary"
                  aria-label="+1"
                >
                  <Plus className="h-4 w-4" />
                </button>
          </div>

          {days > 1 && (
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={roundTrip}
                onChange={(e) => setRoundTrip(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                Rundtur tilbake til <strong>{origin || "start"}</strong>
              </span>
            </label>
          )}
            </Field>
          </div>

          <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canNextStep1}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {w.common.continue} <ArrowRight className="h-5 w-5" strokeWidth={3} />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary">{w.ai.step2Eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{w.ai.step2Title}</h1>
          <p className="mt-3 text-muted-foreground">{w.ai.step2Body}</p>

          <div className="mt-6 space-y-3">
            {waypoints.map((r) => (
              <div key={r.key} className="rounded-2xl border border-border bg-surface p-3 flex items-center gap-2">
                <span className="text-xl shrink-0">📍</span>
                <div className="flex-1 min-w-0">
                  <PlaceAutocomplete
                    value={r.text}
                    onTextChange={(v) => updateWp(r.key, { text: v })}
                    selected={r.place}
                    onSelect={(p) => updateWp(r.key, { place: p })}
                    placeholder={w.ai.waypointPlaceholder}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeWp(r.key)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                  aria-label={w.ai.removeWaypoint}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {waypoints.length < 5 && (
            <button
              type="button"
              onClick={addWp}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-primary"
            >
              <Plus className="h-4 w-4" /> {w.ai.addWaypoint}
            </button>
          )}

          {suggestions.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{w.ai.suggestionsLabel}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const added = waypoints.some((r) => r.text.toLowerCase() === s.toLowerCase());
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={added || waypoints.length >= 5}
                      onClick={() => addSuggestion(s)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs",
                        added ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-surface hover:border-primary"
                      )}
                    >
                      {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-10 sticky bottom-24 md:bottom-0 md:static flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-4 text-base font-bold uppercase tracking-wider hover:border-primary"
            >
              {w.ai.skip}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
            >
              {w.common.continue} <ArrowRight className="h-5 w-5" strokeWidth={3} />
            </button>
          </div>
        </>
      )}

      {step === 3 && selectedVehicle && (
        <>
          <p className="mt-8 text-[11px] uppercase tracking-[0.28em] text-primary">{w.ai.step3Eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{w.ai.step3Title}</h1>
          <p className="mt-3 text-muted-foreground">{w.ai.step3Body}</p>

          <p className="mt-6 text-[11px] uppercase tracking-wider text-muted-foreground">{nt.vehicle}</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map((v) => {
              const vm = vehicleMeta(v.type);
              const em = energyMeta(v.energy);
              const active = v.id === vehicleId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setVehicleId(v.id); setStyle(v.defaultStyle); }}
                  className={cn(
                    "rounded-2xl border-2 bg-surface p-4 text-left flex gap-3 items-start",
                    active ? "border-primary bg-gradient-to-b from-primary/10 to-transparent" : "border-border"
                  )}
                >
                  <div className="h-12 w-12 rounded-xl border border-border bg-surface-2 grid place-items-center text-2xl shrink-0">
                    {v.photo ? <img src={v.photo} alt={v.name} className="h-full w-full object-cover rounded-xl" /> : <span>{vm.emoji}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base uppercase leading-tight">{v.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{vm.label} · {em.emoji} {em.label}</p>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-[11px] uppercase tracking-wider text-muted-foreground">{w.ai.styleLabel}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {ROUTE_STYLES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStyle(s.value)}
                className={cn(
                  "rounded-2xl border-2 bg-surface p-3 text-left",
                  style === s.value ? "border-primary bg-gradient-to-b from-primary/10 to-transparent" : "border-border"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{s.emoji}</span>
                  <span className="font-display uppercase text-sm">{s.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{w.ai.maxHoursLabel}</p>
              <p className="font-display text-xl">{maxHours}t</p>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={maxHours}
              onChange={(e) => setMaxHours(parseInt(e.target.value, 10))}
              className="mt-3 w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>2t</span><span>10t</span>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidHighway}
              onChange={(e) => setAvoidHighway(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">{w.ai.avoidHighway}</span>
          </label>

          <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
            <button
              type="button"
              onClick={startGenerate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
            >
              <Sparkles className="h-5 w-5" /> {w.ai.generateCta}
            </button>
          </div>
        </>
      )}

      {step === 4 && selectedVehicle && (
        <GenerateProgress
          onCancel={() => setStep(3)}
          onDone={(tripId) => navigate({ to: "/trips/$tripId", params: { tripId } })}
          onError={() => { toast.error(w.generate.failed); setStep(3); }}
          initialSteps={[
            "AI planlegger turen din…",
          ]}
          run={async (report) => {
            const isRoundTrip = roundTrip && days > 1;
            const finalDestinationText = isRoundTrip ? origin : destination;
            const fromResolved = await ensurePlace(origin, fromPlace);
            const toResolvedDirect = await ensurePlace(destination, toPlace);
            const toResolved = isRoundTrip ? fromResolved : toResolvedDirect;

            // Resolve waypoints (filter blanks)
            const wpInputs = waypoints.filter((r) => r.text.trim().length > 0);
            const wpResolved = await Promise.all(
              wpInputs.map(async (r) => ({ text: r.text.trim(), place: await ensurePlace(r.text, r.place) }))
            );

            // For round trips, the typed destination becomes a required waypoint.
            const aiWaypoints = isRoundTrip
              ? [destination, ...wpResolved.map((w) => w.text)]
              : wpResolved.map((w) => w.text);

            // 1) Ask AI for a full day-by-day plan with real stops.
            report("Spør AI om dag-for-dag plan…");
            let plan: AiPlanResult | null = null;
            try {
              const planRes = await generateAiPlan({
                data: {
                  origin,
                  destination: finalDestinationText,
                  days,
                  roundTrip: isRoundTrip,
                  waypoints: aiWaypoints,
                  vehicleLabel: vehicleMeta(selectedVehicle.type).label,
                  energyLabel: selectedVehicle.energy,
                  styleLabel: styleMeta(style).label,
                  maxHoursPerDay: maxHours,
                  stopInterests: selectedVehicle.stopInterests ?? [],
                  avoidHighway,
                  language: "nb",
                },
              });
              if (planRes.error) console.warn("[ai-wizard] plan failed:", planRes.error);
              if (!planRes.plan) console.warn("[ai-wizard] plan is null, falling back to empty trip");
              if (planRes.error === "rate_limited") toast.warning("AI er travel — bruker enkel plan.");
              else if (planRes.error === "credits_exhausted") toast.warning("AI-kreditt er brukt opp — bruker enkel plan.");
              plan = planRes.plan;
            } catch (err) {
              console.error("[ai-wizard] plan call failed", err);
            }

            // 2) Nearby partners
            let routePartners: Awaited<ReturnType<typeof fetchRoutePartnersFn>>["partners"] = [];
            if (fromResolved && toResolved) {
              try {
                const res = await fetchRoutePartnersFn({
                  data: {
                    origin: { lat: fromResolved.lat, lng: fromResolved.lng },
                    destination: { lat: toResolved.lat, lng: toResolved.lng },
                    radiusKm: 50,
                  },
                });
                routePartners = res.partners;
              } catch { /* ignore */ }
            }

            const vt = selectedVehicle.type;
            const energy = energyTypeToSource(selectedVehicle.energy);
            const styleImpliesNoHighway = style === "scenic" || style === "curvy" || style === "tourist";
            const finalAvoidHighway = avoidHighway || styleImpliesNoHighway;
            const avoidFerries = !!selectedVehicle.drivingFlags?.["no-ferry"];

            report("Beregner kjørerute…");
            let route: RouteResult | null = null;
            if (fromResolved && toResolved) {
              route = await getRoute({
                origin: { lat: fromResolved.lat, lng: fromResolved.lng },
                destination: { lat: toResolved.lat, lng: toResolved.lng },
                vehicleType: vt,
                routeStyle: style,
                avoidHighways: finalAvoidHighway,
                avoidFerries,
              });
            }

            const distanceKm = route?.distanceKm ?? 0;
            const dur = route?.durationMin ?? 0;
            const drivingTime = dur ? `${Math.floor(dur / 60)}t ${dur % 60}min` : "—";

            const waypointHint = wpResolved.length > 0
              ? `Må innom: ${wpResolved.map((w) => w.text).join(", ")}.${isRoundTrip ? ` Rundtur om ${destination}.` : ""}`
              : (isRoundTrip ? `Rundtur om ${destination}.` : "");

            const ai = buildAiSummary({
              origin, destination: finalDestinationText, vehicle: vt, style,
              energy, vehicleName: selectedVehicle.name,
              userPrompt: waypointHint || undefined,
              prefs: {
                drivingFlags: { ...(selectedVehicle.drivingFlags ?? {}), "no-highway": finalAvoidHighway },
                stopInterests: selectedVehicle.stopInterests,
                maxDrivingHours: maxHours,
                pauseEveryMin: prefs.pauseEveryMin,
              },
              nearbyPartners: routePartners.map((p) => ({
                name: p.name, category: p.category, region: p.region, description: p.description,
              })),
            });

            const trip = tripsApi.createTrip({
              title: isRoundTrip ? `${origin} → ${destination} → ${origin}` : `${origin} → ${destination}`,
              subtitle: `${styleMeta(style).label} med ${selectedVehicle.name}`,
              region: "Norge",
              origin, destination: finalDestinationText, startDate: date,
              vehicle: vt, vehicleId: selectedVehicle.id, vehicleName: selectedVehicle.name, energy,
              source: "ai",
              style,
              distanceKm, drivingTime,
              cover: pickCover(style),
              aiSummary: (plan?.summary ? `${plan.summary} ` : "") + ai,
              originLoc: fromResolved ? { lat: fromResolved.lat, lng: fromResolved.lng } : undefined,
              destinationLoc: toResolved ? { lat: toResolved.lat, lng: toResolved.lng } : undefined,
              destinationPlaceTypes: toResolved?.placeTypes,
              originPlaceTypes: fromResolved?.placeTypes,
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

            if (days > 1) tripsApi.splitIntoDays(trip.id, days);
            const bundle = tripsApi.getTripBundle(trip.id);
            const tripDays = bundle.days.sort((a, b) => a.dayNumber - b.dayNumber);

            // Assign sequential dates to days (UTC-safe — avoid timezone day shifts)
            const parts = date.split("-").map(Number);
            if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
              const [y, m, day] = parts;
              tripDays.forEach((d, i) => {
                const dd = new Date(Date.UTC(y, m - 1, day + i));
                tripsApi.updateDay(d.id, { date: dd.toISOString().slice(0, 10) });
              });
            }


            // 3) Apply AI plan: per-day title + stops
            if (plan && plan.days.length > 0) {
              const totalDriveMin = plan.days.reduce((a, d) => a + (d.drivingMinutes || 0), 0);
              const fallbackKm = plan.days.length > 0 ? distanceKm / plan.days.length : 0;
              for (const aiDay of plan.days) {
                const day = tripDays[aiDay.dayNumber - 1];
                if (!day) continue;
                const isLastDay = aiDay.dayNumber === plan.days.length;
                report(`Planlegger dag ${aiDay.dayNumber}: ${aiDay.start} → ${aiDay.end}…`);
                tripsApi.updateDay(day.id, {
                  title: `${aiDay.start} → ${aiDay.end}`,
                  summary: aiDay.summary,
                });
                const dayKm = Math.round(
                  totalDriveMin > 0 && aiDay.drivingMinutes
                    ? distanceKm * (aiDay.drivingMinutes / totalDriveMin)
                    : fallbackKm
                );
                let isFirstStopOfDay = true;
                for (const s of aiDay.stops) {
                  // Skip lodging on final day of a round trip — traveler is home.
                  if (s.type === "lodging" && isLastDay && isRoundTrip) continue;
                  const name = safeStopName(s.name, s.type as StopType);
                  tripsApi.addStop(day.id, {
                    name,
                    type: s.type as StopType,
                    location: name,
                    description: s.description,
                    durationMin: s.durationMin,
                    durationSource: "ai",
                    reason: "AI-foreslått stopp.",
                    distanceFromPrevKm: isFirstStopOfDay ? dayKm : undefined,
                  });
                  isFirstStopOfDay = false;
                }
                const lodgingName = (aiDay.lodging ?? "").trim();
                const skipLodging = isLastDay && isRoundTrip;
                const validLodging = lodgingName.length > 0 && !/^ingen$/i.test(lodgingName);
                if (validLodging && !skipLodging && !aiDay.stops.some((s) => s.type === "lodging")) {
                  tripsApi.addStop(day.id, {
                    name: safeStopName(lodgingName, "lodging"),
                    type: "lodging",
                    location: aiDay.end,
                    description: "Foreslått overnatting.",
                    durationMin: 720,
                    durationSource: "ai",
                    reason: "AI-foreslått overnatting.",
                  });
                }
              }
            } else {
              // Fallback: distribute typed waypoints across days
              const n = wpResolved.length;
              wpResolved.forEach((wp, i) => {
                const dayIdx = n === 0 ? 0 : Math.min(tripDays.length - 1, Math.floor(((i + 1) / (n + 1)) * tripDays.length));
                const day = tripDays[dayIdx];
                if (!day) return;
                const placeTypes = wp.place?.placeTypes;
                const type = looksLikeLodging(wp.text, placeTypes) ? "lodging" : "city";
                tripsApi.addStop(day.id, {
                  name: wp.text, type, location: wp.text,
                  lat: wp.place?.lat, lng: wp.place?.lng, placeTypes,
                  reason: "Lagt til som ønsket stopp.",
                });
              });
            }

            // Ferry segments
            if (route?.ferrySegments && route.ferrySegments.length > 0) {
              try { tripsApi.applyFerrySegments(trip.id, route.ferrySegments); } catch { /* ignore */ }
            }

            // Partner stops
            report("Legger til anbefalte partnere…");
            try {
              const b2 = tripsApi.getTripBundle(trip.id);
              const allDays = b2.days.slice().sort((a, b) => a.dayNumber - b.dayNumber);
              if (allDays.length > 0 && routePartners.length > 0) {
                const map: Record<string, "food" | "lodging" | "attraction" | "fuel"> = {
                  mat: "food", overnatting: "lodging", attraksjon: "attraction", drivstoff: "fuel",
                };
                const partners = routePartners.slice(0, 2);
                partners.forEach((p, i) => {
                  // Distribute partner stops proportionally across days
                  const dayIdx = Math.min(
                    allDays.length - 1,
                    Math.floor((i / partners.length) * allDays.length),
                  );
                  const targetDay = allDays[dayIdx];
                  tripsApi.addStop(targetDay.id, {
                    name: p.name,
                    type: map[p.category] ?? "attraction",
                    description: p.description ?? undefined,
                    location: p.region ?? undefined,
                    lat: p.lat, lng: p.lng,
                    isPartner: true, promoted: true,
                    partnerId: p.id,
                    partnerWebsite: p.website ?? undefined,
                    partnerLogoUrl: p.logo_url ?? undefined,
                    reason: "Anbefalt partner langs ruta — tydelig merket.",
                  });
                });
              }
            } catch { /* ignore */ }

            try {
              const { computeTimeBreakdown } = await import("@/lib/trip-time");
              const b3 = tripsApi.getTripBundle(trip.id);
              if (b3.trip) {
                const breakdown = computeTimeBreakdown(b3.trip, b3.days, b3.stops);
                tripsApi.updateTrip(trip.id, { timeBreakdown: breakdown });
              }
            } catch { /* ignore */ }

            report("Din tur er klar!");
            return trip.id;
          }}
        />
      )}
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

function GenerateProgress({
  initialSteps, run, onDone, onError, onCancel,
}: {
  initialSteps: string[];
  run: (report: (msg: string) => void) => Promise<string>;
  onDone: (tripId: string) => void;
  onError: (err: unknown) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const w = t.wizard;
  const [steps, setSteps] = useState<string[]>(initialSteps);
  const tripIdRef = useRef<string | null>(null);
  const errorRef = useRef<unknown>(null);
  const [done, setDone] = useState(false);

  // Kick off the real work once
  useEffect(() => {
    let mounted = true;
    const report = (msg: string) => {
      if (!mounted) return;
      setSteps((prev) => (prev[prev.length - 1] === msg ? prev : [...prev, msg]));
    };
    run(report)
      .then((id) => { if (mounted) { tripIdRef.current = id; setDone(true); } })
      .catch((err) => {
        console.error("[ai-wizard] generate failed", err);
        if (mounted) errorRef.current = err;
      });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When done or errored, transition out after a brief beat
  useEffect(() => {
    const poll = setInterval(() => {
      if (errorRef.current) { clearInterval(poll); onError(errorRef.current); }
      else if (done && tripIdRef.current) {
        clearInterval(poll);
        const id = tripIdRef.current;
        setTimeout(() => onDone(id), 600);
      }
    }, 200);
    return () => clearInterval(poll);
  }, [done, onDone, onError]);

  const activeIndex = done ? steps.length - 1 : Math.max(0, steps.length - 1);

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <NorwayMapAnimation />

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.28em] text-primary">{w.generate.loading}</p>

        <ul className="mt-6 space-y-3 max-h-[40vh] overflow-y-auto">
          {steps.map((label, i) => {
            const isDone = i < activeIndex || (i === steps.length - 1 && done);
            const current = i === activeIndex && !isDone;
            return (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={cn(
                  "mt-0.5 h-5 w-5 grid place-items-center rounded-full border shrink-0 transition-colors",
                  isDone ? "bg-primary border-primary text-primary-foreground"
                    : current ? "border-primary text-primary animate-pulse"
                    : "border-border text-muted-foreground"
                )}>
                  {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="text-[10px]">{i + 1}</span>}
                </span>
                <span className={isDone || current ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-center text-[11px] uppercase tracking-wider text-muted-foreground">
          {w.generate.poweredBy}
        </p>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {w.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

function NorwayMapAnimation() {
  // Stylised Norway silhouette with an animated orange route line.
  return (
    <div className="mx-auto w-48 h-56 relative">
      <svg viewBox="0 0 200 240" className="w-full h-full" aria-hidden="true">
        <path
          d="M110 10 L130 30 L120 55 L140 70 L130 95 L150 110 L135 135 L150 160 L130 180 L115 200 L100 215 L85 230 L80 215 L90 195 L80 175 L95 155 L80 135 L95 115 L85 95 L100 75 L90 55 L100 35 Z"
          fill="hsl(var(--surface, 0 0% 12%) / 0.4)"
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
        <path
          d="M105 25 C 120 60, 90 95, 115 130 S 95 190, 92 220"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="300"
          strokeDashoffset="300"
          style={{ animation: "veiglede-draw 4s ease-out forwards" }}
        />
        <circle cx="105" cy="25" r="4" fill="hsl(var(--primary))" />
        <circle cx="92" cy="220" r="4" fill="hsl(var(--primary))"
          style={{ animation: "veiglede-pulse 1.2s ease-out infinite", transformOrigin: "92px 220px" }} />
      </svg>
      <style>{`
        @keyframes veiglede-draw { to { stroke-dashoffset: 0; } }
        @keyframes veiglede-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.6); } }
      `}</style>
    </div>
  );
}
