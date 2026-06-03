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
      const origin = validRows[0];
      const destination = validRows[validRows.length - 1];
      const middle = validRows.slice(1, -1);

      const fromResolved = await ensurePlace(origin);
      const toResolved = await ensurePlace(destination);

      const energy = energyTypeToSource(selectedVehicle.energy);
      const vt = selectedVehicle.type;

      let route: Awaited<ReturnType<typeof getRoute>> | null = null;
      if (fromResolved && toResolved) {
        route = await getRoute({
          origin: { lat: fromResolved.lat, lng: fromResolved.lng },
          destination: { lat: toResolved.lat, lng: toResolved.lng },
          vehicleType: vt,
          routeStyle: style,
          avoidHighways: avoidHighway,
          avoidFerries: !!selectedVehicle.drivingFlags?.["no-ferry"],
        });
      }

      const distanceKm = route?.distanceKm ?? 0;
      const dur = route?.durationMin ?? 0;
      const drivingTime = dur ? `${Math.floor(dur / 60)}t ${dur % 60}min` : "—";

      const startDate = origin.date || validRows.find((r) => r.date)?.date || undefined;

      const trip = tripsApi.createTrip({
        title: `${origin.text} → ${destination.text}`,
        subtitle: `${styleMeta(style).label} med ${selectedVehicle.name}`,
        region: "Norge",
        origin: origin.text,
        destination: destination.text,
        startDate,
        vehicle: vt,
        vehicleId: selectedVehicle.id,
        vehicleName: selectedVehicle.name,
        energy,
        style,
        distanceKm,
        drivingTime,
        cover: pickCover(style),
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
      });

      const maxDay = Math.max(1, ...validRows.map((r) => r.dayNumber));
      if (maxDay > 1) tripsApi.splitIntoDays(trip.id, maxDay);

      const bundle = tripsApi.getTripBundle(trip.id);
      const daysByNumber = new Map(bundle.days.map((d) => [d.dayNumber, d]));

      validRows.forEach((r) => {
        const day = daysByNumber.get(r.dayNumber);
        if (day && r.date) tripsApi.updateDay(day.id, { date: r.date });
      });

      for (const r of middle) {
        const place = await ensurePlace(r);
        const day = daysByNumber.get(r.dayNumber) ?? daysByNumber.get(1);
        if (!day) continue;
        tripsApi.addStop(day.id, {
          name: r.text.trim(),
          type: detectType(r.text, r.type),
          location: r.text.trim(),
          lat: place?.lat,
          lng: place?.lng,
          placeTypes: place?.placeTypes,
        });
      }

      if (route?.ferrySegments && route.ferrySegments.length > 0) {
        try { tripsApi.applyFerrySegments(trip.id, route.ferrySegments); } catch { /* no-op */ }
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
                      <p className="text-[11px] text-muted-foreground pl-7">
                        🌙 {nights ? `${nights} ${nights === 1 ? "natt" : "netter"}` : "Legg til neste stopp for å beregne netter"}
                      </p>
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
