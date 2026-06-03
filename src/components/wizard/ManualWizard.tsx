import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, Sparkles, Loader2, FileText, X, Check } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useVehicles, energyTypeToSource, type Vehicle } from "@/lib/vehicles-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import type { ResolvedPlace } from "@/lib/places/geocoder";
import { tripsApi, ROUTE_STYLES, styleMeta, vehicleMeta, type RouteStyle, type CoverKey, type StopType, looksLikeLodging } from "@/lib/trips-store";
import { getRoute } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { importTripFromTextFn, type ImportedStop } from "@/lib/trip-import.functions";

interface Row {
  key: string;
  text: string;
  place: ResolvedPlace | null;
  date: string;
  dayNumber: number;
  type?: "lodging" | "city" | "waypoint";
  nights?: number;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function newRow(): Row { return { key: uid(), text: "", place: null, date: "", dayNumber: 1 }; }

// Haversine km between two coords.
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Extract a friendly city/place name from a free-form label, stripping
// hotel chain prefixes and trailing administrative parts.
function cityNameFromLabel(label: string, place: ResolvedPlace | null): string {
  // Prefer the place's structured city/locality if available.
  const candidate = place?.label ?? label;
  if (!candidate) return label;
  // Split on commas → first segment is usually the name, rest is city/region.
  const parts = candidate.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return label;
  // If first part looks like a hotel/lodging chain, prefer the next part.
  const first = parts[0];
  const looksHotel = /scandic|thon|clarion|radisson|hilton|marriott|comfort|quality|first hotel|hotel|hotell|hostel|camping/i.test(first);
  if (looksHotel && parts.length > 1) return parts[1];
  return first;
}

function addDays(iso: string, n: number): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDateLong(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function rowsFromImported(stops: ImportedStop[]): Row[] {
  return stops.map((s) => ({
    key: uid(), text: s.name, place: null,
    date: s.date ?? "", dayNumber: s.dayNumber, type: s.type,
  }));
}

function detectType(text: string, hint?: Row["type"]): StopType {
  if (hint === "lodging") return "lodging";
  if (looksLikeLodging(text)) return "lodging";
  return "city";
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

export function ManualWizard({ onBack }: { onBack: () => void }) {
  const t = useT();
  const w = t.wizard;
  const navigate = useNavigate();
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();
  const defaultVehicle: Vehicle | undefined = vehicles.find((v) => v.id === defaultId) ?? vehicles[0];

  const [step, setStep] = useState<1 | 2>(1);
  const [rows, setRows] = useState<Row[]>(() => {
    const today = new Date(); today.setDate(today.getDate() + 7);
    const start = today.toISOString().slice(0, 10);
    const r0: Row = { key: uid(), text: "", place: null, date: start, dayNumber: 1 };
    const r1: Row = { key: uid(), text: "", place: null, date: addDays(start, 1), dayNumber: 2 };
    const r2: Row = { key: uid(), text: "", place: null, date: addDays(start, 2), dayNumber: 3 };
    return [r0, r1, r2];
  });
  const [vehicleId, setVehicleId] = useState<string | undefined>(defaultVehicle?.id);
  const [style, setStyle] = useState<RouteStyle>(defaultVehicle?.defaultStyle ?? "scenic");
  const [avoidHighway, setAvoidHighway] = useState<boolean>(!!prefs.drivingFlags?.["no-highway"]);
  const [importOpen, setImportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? defaultVehicle;

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  // Auto-fill date for a new row based on the previous row's date (+1 day).
  const makeRowAfter = (prev: Row | undefined, opts?: { lodging?: boolean }): Row => {
    const date = prev?.date ? addDays(prev.date, 1) : "";
    const dayNumber = (prev?.dayNumber ?? 0) + 1;
    return {
      key: uid(), text: "", place: null, date, dayNumber,
      type: opts?.lodging ? "lodging" : undefined,
    };
  };
  const addRow = () => setRows((rs) => [...rs, makeRowAfter(rs[rs.length - 1])]);
  const insertLodgingAfter = (key: string) => setRows((rs) => {
    const idx = rs.findIndex((r) => r.key === key);
    if (idx < 0) return rs;
    const lodging = makeRowAfter(rs[idx], { lodging: true });
    const next = [...rs];
    next.splice(idx + 1, 0, lodging);
    return next;
  });

  const validRows = rows.filter((r) => r.text.trim().length > 0);
  const canContinue = validRows.length >= 2;

  const ensurePlace = async (r: Row): Promise<ResolvedPlace | null> => {
    if (r.place) return r.place;
    const { searchPlaces, resolveGooglePlace } = await import("@/lib/places/geocoder");
    const res = await searchPlaces(r.text.trim(), new AbortController().signal);
    const first = res.results[0];
    if (!first) return null;
    if (first.needsDetails) return await resolveGooglePlace(first);
    return first;
  };

  const goGenerate = async () => {
    if (!selectedVehicle || !canContinue) {
      toast.error(w.manual.tooFewStops);
      return;
    }
    setGenerating(true);
    try {
      // 1) Resolve places for every row in parallel.
      const resolvedPlaces = await Promise.all(validRows.map((r) => ensurePlace(r)));

      // 2) Expand multi-night lodging rows into consecutive days.
      // Each "step" represents one travel day. A lodging row with nights = N
      // produces 1 driving day + (N-1) rest days at the same location.
      type Step = {
        row: Row;
        place: ResolvedPlace | null;
        date: string;
        isRestDay: boolean;
      };
      const steps: Step[] = [];
      validRows.forEach((r, i) => {
        const place = resolvedPlaces[i];
        const tp = detectType(r.text, r.type);
        const nights = tp === "lodging" ? Math.max(1, r.nights ?? 1) : 1;
        for (let n = 0; n < nights; n++) {
          steps.push({
            row: r,
            place,
            date: r.date ? addDays(r.date, n) : "",
            isRestDay: n > 0,
          });
        }
      });

      // 3) Compute per-leg routes sequentially (step i → step i+1).
      // A "rest day" or same-location leg yields a 0-km leg.
      const energy = energyTypeToSource(selectedVehicle.energy);
      const vt = selectedVehicle.type;
      type Leg = { distanceKm: number; durationMin: number; geometry?: { lat: number; lng: number }[] };
      const legs: Leg[] = [];
      let firstLegRoute: Awaited<ReturnType<typeof getRoute>> | null = null;
      const fullGeometry: { lat: number; lng: number }[] = [];

      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1];
        const cur = steps[i];
        if (cur.isRestDay || !prev.place || !cur.place) {
          legs.push({ distanceKm: 0, durationMin: 0 });
          continue;
        }
        // Skip identical points.
        if (prev.place.lat === cur.place.lat && prev.place.lng === cur.place.lng) {
          legs.push({ distanceKm: 0, durationMin: 0 });
          continue;
        }
        const r = await getRoute({
          origin: { lat: prev.place.lat, lng: prev.place.lng },
          destination: { lat: cur.place.lat, lng: cur.place.lng },
          vehicleType: vt,
          routeStyle: style,
          avoidHighways: avoidHighway,
          avoidFerries: !!selectedVehicle.drivingFlags?.["no-ferry"],
        });
        if (i === 1) firstLegRoute = r;
        legs.push({ distanceKm: r.distanceKm, durationMin: r.durationMin, geometry: r.geometry });
        if (r.geometry?.length) fullGeometry.push(...r.geometry);
      }

      const totalDistanceKm = Math.round(legs.reduce((a, l) => a + l.distanceKm, 0));
      const totalDurationMin = legs.reduce((a, l) => a + l.durationMin, 0);
      const drivingTime = totalDurationMin
        ? `${Math.floor(totalDurationMin / 60)}t ${Math.round(totalDurationMin % 60)}min`
        : "—";

      // 4) Round-trip detection (last step ≈ first step location, within 5 km).
      const first = steps[0];
      const last = steps[steps.length - 1];
      const isRoundTrip = !!(first.place && last.place &&
        haversineKm(
          { lat: first.place.lat, lng: first.place.lng },
          { lat: last.place.lat, lng: last.place.lng },
        ) < 5);

      // 5) Build a smart title using city names of meaningful stops.
      const cityNames = steps.map((s) => cityNameFromLabel(s.row.text, s.place));
      let title: string;
      if (isRoundTrip && cityNames.length >= 2) {
        const middle = Array.from(new Set(cityNames.slice(1, -1))).slice(0, 2);
        title = middle.length
          ? `${cityNames[0]} → ${middle.join(" → ")} → ${cityNames[0]}`
          : `Rundtur ${cityNames[0]}`;
      } else {
        // Dedupe consecutive duplicates from rest days.
        const dedup = cityNames.filter((c, i) => i === 0 || c !== cityNames[i - 1]);
        title = dedup.length <= 3
          ? dedup.join(" → ")
          : `${dedup[0]} → ${dedup.slice(1, -1).slice(0, 2).join(" → ")} → ${dedup[dedup.length - 1]}`;
      }

      const startDate = first.date || validRows.find((r) => r.date)?.date || undefined;
      const destinationLabel = last.row.text;
      const originLabel = first.row.text;
      const fromResolved = first.place;
      const toResolved = last.place;

      const trip = tripsApi.createTrip({
        title,
        subtitle: `${styleMeta(style).label} med ${selectedVehicle.name}`,
        region: "Norge",
        origin: originLabel,
        destination: destinationLabel,
        startDate,
        vehicle: vt,
        vehicleId: selectedVehicle.id,
        vehicleName: selectedVehicle.name,
        energy,
        style,
        distanceKm: totalDistanceKm,
        drivingTime,
        cover: pickCover(style),
        isRoundTrip,
        originLoc: fromResolved ? { lat: fromResolved.lat, lng: fromResolved.lng } : undefined,
        destinationLoc: toResolved ? { lat: toResolved.lat, lng: toResolved.lng } : undefined,
        destinationPlaceTypes: toResolved?.placeTypes,
        originPlaceTypes: fromResolved?.placeTypes,
        routeGeometry: fullGeometry.length ? fullGeometry : firstLegRoute?.geometry,
        routeDistanceKm: totalDistanceKm,
        routeDurationMin: totalDurationMin,
        routeProvider: firstLegRoute?.provider,
        routeProfile: firstLegRoute?.profile,
        routeAvoidHighways: firstLegRoute?.avoidOptions?.highways,
        routeAvoidFerries: firstLegRoute?.avoidOptions?.ferries,
      });

      // 6) Ensure we have one day per step (skip any trailing empty steps).
      const dayCount = steps.length;
      if (dayCount > 1) tripsApi.splitIntoDays(trip.id, dayCount);

      const bundle = tripsApi.getTripBundle(trip.id);
      const orderedDays = [...bundle.days].sort((a, b) => a.dayNumber - b.dayNumber);

      // 7) Set per-day route data + date + title.
      steps.forEach((s, i) => {
        const day = orderedDays[i];
        if (!day) return;
        const leg = legs[i - 1]; // leg INTO this day
        const prevCity = i > 0 ? cityNameFromLabel(steps[i - 1].row.text, steps[i - 1].place) : "";
        const curCity = cityNameFromLabel(s.row.text, s.place);
        const dayTitle = s.isRestDay
          ? `Hviledag — ${curCity}`
          : i === 0
            ? `${curCity}`
            : `${prevCity} → ${curCity}`;
        tripsApi.updateDay(day.id, {
          date: s.date || undefined,
          title: dayTitle,
          dayDistanceKm: leg ? Math.round(leg.distanceKm) : 0,
          dayDrivingTimeMin: leg ? Math.round(leg.durationMin) : 0,
          dayRouteGeometry: leg?.geometry,
        });
      });

      // 8) The auto-created "Ankomst {destination}" stop sits on day 1 from
      // createTrip(). Move it to the actual last day so multi-day trips
      // show arrival on the correct day.
      const ankomst = bundle.stops.find((s) =>
        s.dayId === orderedDays[0]?.id && s.name?.startsWith("Ankomst "));
      const lastDay = orderedDays[orderedDays.length - 1];
      if (ankomst && lastDay && lastDay.id !== ankomst.dayId) {
        tripsApi.updateStop(ankomst.id, {
          dayId: lastDay.id,
          name: `Ankomst ${cityNameFromLabel(last.row.text, last.place)}`,
          distanceFromPrevKm: legs[legs.length - 1] ? Math.round(legs[legs.length - 1].distanceKm) : undefined,
        });
      }

      // 9) Add intermediate stops on the right days (skip origin & destination).
      for (let i = 1; i < steps.length - 1; i++) {
        const s = steps[i];
        const day = orderedDays[i];
        if (!day || s.isRestDay) continue;
        const leg = legs[i - 1];
        const stopType = detectType(s.row.text, s.row.type);
        tripsApi.addStop(day.id, {
          name: s.row.text.trim(),
          type: stopType,
          location: s.row.text.trim(),
          lat: s.place?.lat,
          lng: s.place?.lng,
          placeTypes: s.place?.placeTypes,
          distanceFromPrevKm: leg ? Math.round(leg.distanceKm) : undefined,
        });
      }

      if (firstLegRoute?.ferrySegments && firstLegRoute.ferrySegments.length > 0) {
        try { tripsApi.applyFerrySegments(trip.id, firstLegRoute.ferrySegments); } catch { /* no-op */ }
      }

      toast.success(w.generate.success);
      navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
    } catch (err) {
      console.error("[manual-wizard] generate failed", err);
      toast.error(w.generate.failed);
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <div className="py-12 max-w-2xl mx-auto text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-5 font-display text-2xl uppercase">{w.manual.generating}</p>
      </div>
    );
  }

  return (
    <div className="py-4 md:py-8 max-w-2xl mx-auto pb-32 md:pb-12">
      <div className="flex items-center justify-between">
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {step === 1 ? w.common.backToMode : w.common.back}
        </button>
        <div className="flex gap-1.5">
          {[1, 2].map((i) => (
            <span key={i} className={cn("h-1.5 w-8 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <>
          <h1 className="mt-6 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{w.manual.title}</h1>
          <p className="mt-3 text-muted-foreground">{w.manual.subtitle}</p>

          {(() => {
            const first = validRows[0];
            const last = validRows[validRows.length - 1];
            if (!first?.place || !last?.place || first === last) return null;
            const km = haversineKm(
              { lat: first.place.lat, lng: first.place.lng },
              { lat: last.place.lat, lng: last.place.lng },
            );
            if (km >= 5) return null;
            return (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                ✓ Rundtur detektert — slutter der den startet
              </div>
            );
          })()}

          <div className="mt-6 space-y-2">

            {rows.map((r, idx) => {
              const tp = detectType(r.text, r.type);
              const icon = tp === "lodging" ? "🏨" : "🏙️";
              const next = rows[idx + 1];
              const nights = tp === "lodging" && r.date && next?.date
                ? Math.max(1, Math.round((new Date(next.date).getTime() - new Date(r.date).getTime()) / 86400000))
                : null;
              const isLast = idx === rows.length - 1;
              return (
                <div key={r.key}>
                  <div className="rounded-2xl border border-border bg-surface p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider font-bold text-primary">{w.manual.dayLabel(r.dayNumber)}</span>
                      <span className="text-sm font-semibold text-foreground">
                        📅 {r.date ? formatDateLong(r.date) : <span className="text-muted-foreground italic">velg dato</span>}
                      </span>
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.key, { date: e.target.value })}
                        className="ml-auto bg-background border border-border rounded-md px-2 py-1 text-xs"
                        aria-label={w.manual.dateLabel}
                      />
                      <button
                        onClick={() => removeRow(r.key)}
                        className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
                        aria-label={w.manual.removeStop}
                        disabled={rows.length <= 2}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{idx === 0 ? "📍" : idx === rows.length - 1 ? "🏁" : icon}</span>
                      <div className="flex-1 min-w-0">
                        <PlaceAutocomplete
                          value={r.text}
                          onTextChange={(v) => updateRow(r.key, { text: v })}
                          selected={r.place}
                          onSelect={(p) => updateRow(r.key, { place: p })}
                          placeholder={w.manual.placeholder}
                        />
                      </div>
                    </div>
                    {tp === "lodging" && (
                      <div className="flex items-center gap-2 pl-7 text-[11px] text-muted-foreground">
                        <span>🌙 Netter:</span>
                        <button
                          type="button"
                          onClick={() => updateRow(r.key, { nights: Math.max(1, (r.nights ?? 1) - 1) })}
                          className="h-6 w-6 rounded-md border border-border bg-background hover:border-primary"
                          aria-label="Færre netter"
                        >−</button>
                        <span className="font-mono tabular-nums text-foreground min-w-[1.5rem] text-center">{r.nights ?? 1}</span>
                        <button
                          type="button"
                          onClick={() => updateRow(r.key, { nights: Math.min(14, (r.nights ?? 1) + 1) })}
                          className="h-6 w-6 rounded-md border border-border bg-background hover:border-primary"
                          aria-label="Flere netter"
                        >+</button>
                        {r.text.trim() && (
                          <span className="ml-2 italic truncate">
                            {(r.nights ?? 1)} {(r.nights ?? 1) === 1 ? "natt" : "netter"} på {r.text.trim()}
                          </span>
                        )}
                      </div>
                    )}
                    {tp !== "lodging" && !r.date && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 pl-7">Dato anbefales</p>
                    )}
                  </div>

                  {!isLast && (
                    <div className="flex justify-center -my-1 relative z-10">
                      <button
                        type="button"
                        onClick={() => insertLodgingAfter(r.key)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-3 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <Plus className="h-3 w-3" /> Legg til overnatting mellom stopp
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-primary"
            >
              <Plus className="h-4 w-4" /> {w.manual.addStop}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
            >
              <FileText className="h-4 w-4" /> {w.manual.importButton}
            </button>
          </div>

          <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {w.common.continue} <ArrowRight className="h-5 w-5" strokeWidth={3} />
            </button>
          </div>
        </>
      )}

      {step === 2 && selectedVehicle && (
        <>
          <h1 className="mt-6 font-display text-4xl md:text-5xl uppercase leading-[0.95]">{w.manual.vehicleStep}</h1>
          <p className="mt-3 text-muted-foreground">{w.manual.vehicleSubtitle}</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map((v) => {
              const vm = vehicleMeta(v.type);
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
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{vm.label}</p>
                  </div>
                  {active && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
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
              </button>
            ))}
          </div>

          <label className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidHighway}
              onChange={(e) => setAvoidHighway(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">{w.manual.avoidHighway}</span>
          </label>

          <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
            <button
              type="button"
              onClick={goGenerate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20"
            >
              <Sparkles className="h-5 w-5" /> {w.common.calculate}
            </button>
          </div>
        </>
      )}

      {importOpen && (
        <ImportSheet
          onClose={() => setImportOpen(false)}
          onApply={(stops) => { setRows(rowsFromImported(stops)); setImportOpen(false); }}
        />
      )}
    </div>
  );
}

function ImportSheet({ onClose, onApply }: { onClose: () => void; onApply: (stops: ImportedStop[]) => void }) {
  const t = useT();
  const w = t.wizard.import;
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportedStop[] | null>(null);
  const importFn = useServerFn(importTripFromTextFn);

  const parse = async () => {
    if (text.trim().length < 3) return;
    setLoading(true);
    try {
      const res = await importFn({ data: { text } });
      if (res.error === "rate_limited") { toast.error(w.rateLimited); return; }
      if (res.error === "credits_exhausted") { toast.error(w.creditsExhausted); return; }
      if (res.error) { toast.error(w.genericError); return; }
      if (!res.stops.length) { toast.error(w.empty); return; }
      setPreview(res.stops);
    } catch (err) {
      console.error("[import] failed", err);
      toast.error(w.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end md:items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl uppercase">{w.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{w.body}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="close" className="p-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!preview && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={w.placeholder}
              rows={10}
              className="mt-4 w-full bg-background border border-border rounded-xl px-3 py-3 text-sm font-mono"
            />
            <button
              type="button"
              onClick={parse}
              disabled={loading || text.trim().length < 3}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? w.parsing : w.parse}
            </button>
          </>
        )}

        {preview && (
          <>
            <p className="mt-4 text-xs uppercase tracking-wider text-primary font-bold">{w.previewTitle}</p>
            <p className="text-xs text-muted-foreground">{w.previewBody}</p>
            <ul className="mt-3 space-y-2">
              {preview.map((s, i) => (
                <li key={i} className="rounded-xl border border-border bg-background p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{s.type === "lodging" ? "🏨" : s.type === "waypoint" ? "📍" : "🏙️"}</span>
                    <span className="font-semibold">{s.name}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Dag {s.dayNumber}</span>
                  </div>
                  {s.date && <p className="mt-1 text-[11px] text-muted-foreground">{s.date}</p>}
                  {s.notes && <p className="mt-1 text-[11px] text-muted-foreground italic">{s.notes}</p>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold uppercase tracking-wider"
              >
                {w.cancel}
              </button>
              <button
                type="button"
                onClick={() => onApply(preview)}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
              >
                {w.apply}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
