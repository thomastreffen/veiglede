import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, Sparkles, Loader2, FileText, X, Check } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useVehicles, energyTypeToSource, type Vehicle } from "@/lib/vehicles-store";
import { useDriverPrefs } from "@/lib/driver-prefs";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { manualPlace, type ResolvedPlace } from "@/lib/places/geocoder";
import { tripsApi, ROUTE_STYLES, styleMeta, vehicleMeta, type RouteStyle, type CoverKey, type StopType, looksLikeLodging } from "@/lib/trips-store";
import { getRoute } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { importTripFromTextFn, type ImportedStop } from "@/lib/trip-import.functions";
import { PlannerWorkspace } from "@/components/wizard/PlannerWorkspace";
import type { RoutePoint } from "@/components/CuratedRoutePreview";

interface Row {
  key: string;
  text: string;
  place: ResolvedPlace | null;
  date: string;
  dayNumber: number;
  type?: "lodging" | "city" | "waypoint";
  nights?: number;
  /**
   * "destination" = a main leg / next destination (own day in the roadbook).
   * "via" (default) = a quick stop along the current leg.
   * The very last row is always treated as the trip's final destination.
   */
  kind?: "via" | "destination";
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
// hotel chain prefixes and trailing administrative parts. Prefers the
// structured cityName populated by the geocoder when available.
function cityNameFromLabel(label: string, place: ResolvedPlace | null): string {
  if (place?.cityName) return place.cityName;
  const candidate = place?.label ?? label;
  if (!candidate) return label;
  const parts = candidate.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return label;
  const first = parts[0];
  const looksHotel = /scandic|thon|clarion|radisson|hilton|marriott|comfort|quality|first hotel|hotel|hotell|hostel|camping/i.test(first);
  if (looksHotel && parts.length > 1) {
    // Strip Norwegian/EU postal prefix on the next segment.
    return parts[1].replace(/^\d{3,5}\s+/, "").trim() || first;
  }
  return first;
}

function usableLoc(place: ResolvedPlace | null | undefined): { lat: number; lng: number } | undefined {
  if (!place || place.needsDetails) return undefined;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return undefined;
  if (place.lat === 0 && place.lng === 0) return undefined;
  return { lat: place.lat, lng: place.lng };
}

function addDays(iso: string, n: number): string {
  if (!iso) return "";
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((x) => Number.isNaN(x))) return "";
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(y, m - 1, d + n));
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Recalculate date + dayNumber for all rows after the first based on each
// previous row's nights (lodging rows can span multiple days).
function cascadeDates(rows: Row[]): Row[] {
  if (rows.length === 0) return rows;
  const out: Row[] = [];
  let prev: Row | undefined;
  for (const r of rows) {
    if (!prev) {
      out.push({ ...r, dayNumber: 1 });
      prev = out[0];
      continue;
    }
    const prevType = detectType(prev.text, prev.type);
    const prevNights = prevType === "lodging" ? Math.max(1, prev.nights ?? 1) : 1;
    const date = prev.date ? addDays(prev.date, prevNights) : "";
    const dayNumber = (prev.dayNumber ?? 0) + prevNights;
    const next: Row = { ...r, date, dayNumber };
    out.push(next);
    prev = next;
  }
  return out;
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
  const fallbackVehicle: Vehicle = useMemo(() => ({
    id: "manual-default-car",
    name: "Bil",
    type: "car",
    energy: "petrol",
    defaultStyle: "scenic",
    drivingFlags: {},
    stopInterests: ["food", "viewpoint", "attraction", "rest"],
  }), []);
  const defaultVehicle: Vehicle = vehicles.find((v) => v.id === defaultId) ?? vehicles[0] ?? fallbackVehicle;

  const [step, setStep] = useState<1 | 2>(1);
  const [rows, setRows] = useState<Row[]>(() => {
    const today = new Date(); today.setDate(today.getDate() + 7);
    const start = today.toISOString().slice(0, 10);
    // Default to a simple origin → destination trip: one destination row.
    const r0: Row = { key: uid(), text: "", place: null, date: start, dayNumber: 1 };
    return [r0];
  });
  const [errors, setErrors] = useState<{ origin?: string; destination?: string }>({});
  const [vehicleId, setVehicleId] = useState<string | undefined>(defaultVehicle?.id);
  const [style, setStyle] = useState<RouteStyle>(defaultVehicle?.defaultStyle ?? "scenic");
  const [avoidHighway, setAvoidHighway] = useState<boolean>(!!prefs.drivingFlags?.["no-highway"]);
  const [importOpen, setImportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Trip origin — the actual departure point, separate from the first overnight stop.
  const [originText, setOriginText] = useState<string>("");
  const [originPlace, setOriginPlace] = useState<ResolvedPlace | null>(null);
  const [originLocating, setOriginLocating] = useState(false);

  const useMyLocationAsOrigin = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation?.getCurrentPosition) {
      toast.error("Posisjon er ikke støttet i denne nettleseren.");
      return;
    }
    setOriginLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        let friendly: string | null = null;
        try {
          const res = await fetch(`/api/public/google-places?action=reverse&lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const data = (await res.json()) as { label?: string | null };
            if (data.label && typeof data.label === "string") friendly = data.label;
          }
        } catch {
          // ignore — fall back to "Min posisjon"
        }
        const displayName = friendly ?? "Min posisjon";
        const place: ResolvedPlace = {
          id: `gps-${Date.now()}`,
          label: friendly ? `Min posisjon — ${friendly}` : "Min posisjon",
          name: displayName,
          secondary: friendly ? "Min posisjon" : undefined,
          lat, lng,
          type: "address",
          source: "manual",
        };
        setOriginText(displayName);
        setOriginPlace(place);
        setErrors((e) => ({ ...e, origin: undefined }));
        setOriginLocating(false);
        toast.success("Bruker din nåværende posisjon som avreisested.");
      },
      (err) => {
        setOriginLocating(false);
        if (err && err.code === err.PERMISSION_DENIED) {
          setErrors((e) => ({ ...e, origin: "Vi fikk ikke tilgang til posisjonen din. Skriv inn avreisested manuelt." }));
        } else {
          toast.error("Klarte ikke å hente posisjonen din.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  };

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? defaultVehicle;

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => {
      const next = rs.map((r) => (r.key === key ? { ...r, ...patch } : r));
      // If nights or type changed on any row, cascade dates/dayNumber downward.
      if ("nights" in patch || "type" in patch || "date" in patch || "text" in patch) {
        return cascadeDates(next);
      }
      return next;
    });
  const removeRow = (key: string) => setRows((rs) => cascadeDates(rs.filter((r) => r.key !== key)));

  // Auto-fill date for a new row based on the previous row's date + its nights.
  const makeRowAfter = (prev: Row | undefined, opts?: { lodging?: boolean }): Row => {
    const prevType = prev ? detectType(prev.text, prev.type) : "city";
    const prevNights = prev && prevType === "lodging" ? Math.max(1, prev.nights ?? 1) : 1;
    const date = prev?.date ? addDays(prev.date, prevNights) : "";
    const dayNumber = (prev?.dayNumber ?? 0) + prevNights;
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

  // The last row is always the destination; earlier rows are optional via-stops.
  const destinationRow = rows[rows.length - 1];
  const viaRows = rows.slice(0, -1);
  const hasOrigin = originText.trim().length > 0 || !!originPlace;
  const hasDestination = (destinationRow?.text.trim().length ?? 0) > 0 || !!destinationRow?.place;
  const canContinue = hasOrigin && hasDestination;

  const insertViaStop = () => setRows((rs) => {
    if (rs.length === 0) return rs;
    const last = rs[rs.length - 1];
    const newVia = makeRowAfter(rs[rs.length - 2] ?? undefined);
    newVia.kind = "via";
    // Insert before the destination so the destination stays last.
    const next = [...rs.slice(0, -1), newVia, last];
    return cascadeDates(next);
  });

  /**
   * Append a brand new destination ("Neste destinasjon"). The current last
   * row stops being the final destination and becomes a main intermediate
   * stop (kind = "destination"), so it still gets its own day/leg in the
   * roadbook, instead of being treated as a quick via-stop.
   */
  const insertNextDestination = () => setRows((rs) => {
    if (rs.length === 0) return [makeRowAfter(undefined)];
    const promoted = { ...rs[rs.length - 1], kind: "destination" as const };
    const newDest = makeRowAfter(promoted);
    newDest.kind = undefined;
    const next = [...rs.slice(0, -1), promoted, newDest];
    return cascadeDates(next);
  });

  // validRows is kept for downstream goGenerate code that expects an array of stops.
  const validRows = rows.filter((r) => r.text.trim().length > 0);


  const ensurePlace = async (r: Row): Promise<ResolvedPlace | null> => {
    if (r.place) {
      if (!r.place.needsDetails) return r.place;
      const { resolveGooglePlace } = await import("@/lib/places/geocoder");
      return (await resolveGooglePlace(r.place)) ?? manualPlace(r.text.trim()) ?? null;
    }
    const { searchPlaces, resolveGooglePlace } = await import("@/lib/places/geocoder");
    const res = await searchPlaces(r.text.trim(), new AbortController().signal);
    const first = res.results[0];
    if (!first) return manualPlace(r.text.trim());
    if (first.needsDetails) return await resolveGooglePlace(first);
    return first;
  };

  const goGenerate = async () => {
    if (!selectedVehicle || !canContinue) {
      toast.error(w.manual.tooFewStops);
      return;
    }
    setGenerating(true);
    let trip: ReturnType<typeof tripsApi.createTrip> | null = null;
    try {
      const routeRows = rows.filter((r) => r.text.trim().length > 0 || !!r.place);
      if (routeRows.length === 0) {
        toast.error(w.manual.tooFewStops);
        setGenerating(false);
        return;
      }

      const originLabel = (originText.trim() || originPlace?.name || "Avreise").trim();
      const destinationLabel = (routeRows[routeRows.length - 1]?.text.trim() || routeRows[routeRows.length - 1]?.place?.name || "Destinasjon").trim();
      const rawNames = [originLabel, ...routeRows.map((r) => (r.text.trim() || r.place?.name || "Stopp").trim())];
      const rawDedup = rawNames.filter((c, i) => i === 0 || c !== rawNames[i - 1]);
      const title = rawDedup.length <= 3
        ? rawDedup.join(" → ")
        : `${rawDedup[0]} → ${rawDedup.slice(1, -1).slice(0, 2).join(" → ")} → ${rawDedup[rawDedup.length - 1]}`;
      const energy = energyTypeToSource(selectedVehicle.energy);
      const vt = selectedVehicle.type;
      const startDate = (routeRows.find((r) => r.date)?.date) || undefined;

      // 1) Persist the draft before geocoding, route generation, map enrichment
      // or any other provider call. From here on,
      // provider failures must never block trip creation.
      trip = tripsApi.createTrip({
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
        distanceKm: 0,
        drivingTime: "—",
        cover: pickCover(style),
        source: "manual",
      });

      try {
        type Leg = { distanceKm: number; durationMin: number; geometry?: { lat: number; lng: number }[] };
        type Step = { row: Row; place: ResolvedPlace | null; date: string; isRestDay: boolean };
        let originResolved: ResolvedPlace | null = originPlace;
        if (originResolved?.needsDetails) {
          const { resolveGooglePlace } = await import("@/lib/places/geocoder");
          originResolved = (await resolveGooglePlace(originResolved)) ?? manualPlace(originLabel) ?? originResolved;
        } else if (!originResolved && originLabel) {
          const { searchPlaces, resolveGooglePlace } = await import("@/lib/places/geocoder");
          const r = await searchPlaces(originLabel, new AbortController().signal);
          const first = r.results[0];
          originResolved = first ? (first.needsDetails ? await resolveGooglePlace(first) : first) : manualPlace(originLabel);
        }

        const resolvedPlaces = await Promise.all(routeRows.map((r) => ensurePlace(r)));
        const steps: Step[] = [];
        routeRows.forEach((r, i) => {
          const place = resolvedPlaces[i];
          const tp = detectType(r.text || place?.name || "", r.type);
          const nights = tp === "lodging" ? Math.max(1, r.nights ?? 1) : 1;
          for (let n = 0; n < nights; n++) {
            steps.push({ row: r, place, date: r.date ? addDays(r.date, n) : "", isRestDay: n > 0 });
          }
        });
        const toResolved = steps[steps.length - 1]?.place ?? null;
        const originCity = originResolved ? cityNameFromLabel(originLabel, originResolved) : originLabel;
        tripsApi.updateTrip(trip.id, {
          isRoundTrip: !!(usableLoc(originResolved) && usableLoc(toResolved) && haversineKm(usableLoc(originResolved)!, usableLoc(toResolved)!) < 5),
          originLoc: usableLoc(originResolved),
          destinationLoc: usableLoc(toResolved),
          destinationPlaceTypes: toResolved?.placeTypes,
          originPlaceTypes: originResolved?.placeTypes,
        });
        const legs: Leg[] = [];
        let firstLegRoute: Awaited<ReturnType<typeof getRoute>> | null = null;
        const fullGeometry: { lat: number; lng: number }[] = [];

        const computeLeg = async (from: ResolvedPlace | null, to: ResolvedPlace | null, restDay: boolean): Promise<Leg> => {
          const fromLoc = usableLoc(from);
          const toLoc = usableLoc(to);
          if (restDay || !fromLoc || !toLoc) return { distanceKm: 0, durationMin: 0 };
          if (fromLoc.lat === toLoc.lat && fromLoc.lng === toLoc.lng) return { distanceKm: 0, durationMin: 0 };
          const r = await getRoute({
            origin: fromLoc,
            destination: toLoc,
            vehicleType: vt,
            routeStyle: style,
            avoidHighways: avoidHighway,
            avoidFerries: !!selectedVehicle.drivingFlags?.["no-ferry"],
          });
          return { distanceKm: r.distanceKm, durationMin: r.durationMin, geometry: r.geometry };
        };

        const leg0Origin = originResolved;
        const leg0Dest = steps[0]?.place ?? null;
        const leg0 = await computeLeg(leg0Origin, leg0Dest, false);
        legs.push(leg0);
        if (usableLoc(leg0Origin) && usableLoc(leg0Dest)) {
          firstLegRoute = await getRoute({
            origin: usableLoc(leg0Origin)!,
            destination: usableLoc(leg0Dest)!,
            vehicleType: vt,
            routeStyle: style,
            avoidHighways: avoidHighway,
            avoidFerries: !!selectedVehicle.drivingFlags?.["no-ferry"],
          });
          legs[0] = { distanceKm: firstLegRoute.distanceKm, durationMin: firstLegRoute.durationMin, geometry: firstLegRoute.geometry };
        }
        if (legs[0]?.geometry?.length) fullGeometry.push(...legs[0].geometry);

        for (let i = 1; i < steps.length; i++) {
          const leg = await computeLeg(steps[i - 1].place, steps[i].place, steps[i].isRestDay);
          legs.push(leg);
          if (leg.geometry?.length) fullGeometry.push(...leg.geometry);
        }

        const totalDistanceKm = Math.round(legs.reduce((a, l) => a + l.distanceKm, 0));
        const totalDurationMin = legs.reduce((a, l) => a + l.durationMin, 0);
        const drivingTime = totalDurationMin ? `${Math.floor(totalDurationMin / 60)}t ${Math.round(totalDurationMin % 60)}min` : "—";
        tripsApi.updateTrip(trip.id, {
          distanceKm: totalDistanceKm,
          drivingTime,
          routeGeometry: fullGeometry.length ? fullGeometry : firstLegRoute?.geometry,
          routeDistanceKm: totalDistanceKm,
          routeDurationMin: totalDurationMin,
          routeProvider: firstLegRoute?.provider,
          routeProfile: firstLegRoute?.profile,
          routeAvoidHighways: firstLegRoute?.avoidOptions?.highways,
          routeAvoidFerries: firstLegRoute?.avoidOptions?.ferries,
        });

        if (steps.length > 1) tripsApi.splitIntoDays(trip.id, steps.length);
        const bundle = tripsApi.getTripBundle(trip.id);
        const orderedDays = [...bundle.days].sort((a, b) => a.dayNumber - b.dayNumber);
        steps.forEach((s, i) => {
          const day = orderedDays[i];
          if (!day) return;
          const leg = legs[i];
          const prevCity = i === 0 ? originCity : cityNameFromLabel(steps[i - 1].row.text || steps[i - 1].place?.name || "Stopp", steps[i - 1].place);
          const curCity = cityNameFromLabel(s.row.text || s.place?.name || "Stopp", s.place);
          tripsApi.updateDay(day.id, {
            dayNumber: i + 1,
            date: s.date || undefined,
            title: s.isRestDay ? `Hviledag i ${curCity}` : `${prevCity} → ${curCity}`,
            dayDistanceKm: leg ? Math.round(leg.distanceKm) : 0,
            dayDrivingTimeMin: leg ? Math.round(leg.durationMin) : 0,
            dayRouteGeometry: leg?.geometry,
          });
        });

        const ankomst = bundle.stops.find((s) => s.dayId === orderedDays[0]?.id && s.name?.startsWith("Ankomst "));
        const lastDay = orderedDays[orderedDays.length - 1];
        if (ankomst && lastDay && lastDay.id !== ankomst.dayId) {
          tripsApi.updateStop(ankomst.id, {
            dayId: lastDay.id,
            name: `Ankomst ${cityNameFromLabel(destinationLabel, toResolved)}`,
            distanceFromPrevKm: legs[legs.length - 1] ? Math.round(legs[legs.length - 1].distanceKm) : undefined,
          });
        }

        for (let i = 0; i < steps.length - 1; i++) {
          const s = steps[i];
          const day = orderedDays[i];
          if (!day || s.isRestDay) continue;
          const leg = legs[i];
          const stopName = (s.row.text.trim() || s.place?.name || "Stopp").trim();
          const stopType = detectType(stopName, s.row.type);
          const nights = stopType === "lodging" ? Math.max(1, s.row.nights ?? 1) : undefined;
          const checkin = stopType === "lodging" ? (s.date || undefined) : undefined;
          const checkout = stopType === "lodging" && checkin && nights ? addDays(checkin, nights) : undefined;
          tripsApi.addStop(day.id, {
            name: stopName,
            type: stopType,
            location: stopName,
            lat: usableLoc(s.place)?.lat,
            lng: usableLoc(s.place)?.lng,
            placeTypes: s.place?.placeTypes,
            distanceFromPrevKm: leg ? Math.round(leg.distanceKm) : undefined,
            booking: stopType === "lodging" ? { checkinDate: checkin, checkoutDate: checkout, nights, status: "none" as const } : undefined,
          });
        }

        if (firstLegRoute?.ferrySegments?.length) {
          try { tripsApi.applyFerrySegments(trip.id, firstLegRoute.ferrySegments); } catch { /* no-op */ }
        }
      } catch (routeErr) {
        console.warn("[manual-wizard] route enrichment failed after draft save", routeErr);
        toast.warning("Turen er lagret som kladd. Ruten kan beregnes på nytt fra turen.");
      }

      toast.success(w.generate.success);
      navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
    } catch (err) {
      console.error("[manual-wizard] generate failed before draft save", err);
      if (trip) {
        toast.warning("Turen er lagret som kladd, men rutedata mangler.");
        navigate({ to: "/trips/$tripId", params: { tripId: trip.id } });
        return;
      }
      toast.error(w.generate.failed);
      setGenerating(false);
    }
  };

  const mapPoints: RoutePoint[] = useMemo(() => {
    const pts: RoutePoint[] = [];
    if (originPlace) pts.push({ lat: originPlace.lat, lng: originPlace.lng, label: originPlace.name ?? originPlace.label ?? "Start" });
    for (let i = 0; i < rows.length - 1; i++) {
      const r = rows[i];
      if (r.place) pts.push({ lat: r.place.lat, lng: r.place.lng, label: r.place.name ?? r.text });
    }
    const last = rows[rows.length - 1];
    if (last?.place) pts.push({ lat: last.place.lat, lng: last.place.lng, label: last.place.name ?? last.text });
    return pts;
  }, [originPlace, rows]);
  const mapPointsKey = useMemo(() => mapPoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|"), [mapPoints]);


  // Live route preview: when we have ≥2 resolved points, ask the routing
  // engine for the real road geometry so the map shows the actual route
  // (not just a dashed straight line). Debounced + abortable so typing in
  // the planner doesn't fire a request on every keystroke.
  const [livePreview, setLivePreview] = useState<{
    geometry: { lat: number; lng: number }[];
    distanceKm: number;
    durationMin: number;
    pending: boolean;
  } | null>(null);
  const livePreviewSeq = useRef(0);
  useEffect(() => {
    if (mapPoints.length < 2) { setLivePreview(null); return; }
    const seq = ++livePreviewSeq.current;
    // Drop any prior route geometry immediately so the map never shows a
    // stale route line for a different set of stops. The dashed schematic
    // preview takes over until the real road route arrives.
    setLivePreview({ geometry: [], distanceKm: 0, durationMin: 0, pending: true });
    const handle = setTimeout(async () => {
      try {
        const origin = mapPoints[0];
        const destination = mapPoints[mapPoints.length - 1];
        const waypoints = mapPoints.slice(1, -1);
        const r = await getRoute({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          waypoints: waypoints.length ? waypoints.map((w) => ({ lat: w.lat, lng: w.lng })) : undefined,
          vehicleType: selectedVehicle?.type,
          routeStyle: style,
          avoidHighways: avoidHighway,
          avoidFerries: !!selectedVehicle?.drivingFlags?.["no-ferry"],
        });
        if (seq !== livePreviewSeq.current) return;
        setLivePreview({
          geometry: r.geometry,
          distanceKm: r.distanceKm,
          durationMin: r.durationMin,
          pending: false,
        });
      } catch {
        if (seq !== livePreviewSeq.current) return;
        setLivePreview({ geometry: [], distanceKm: 0, durationMin: 0, pending: false });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPointsKey, style, avoidHighway, selectedVehicle?.type, selectedVehicle?.drivingFlags?.["no-ferry"]]);


  const mapSummary = (() => {
    if (livePreview && livePreview.geometry.length > 1) {
      const h = Math.floor(livePreview.durationMin / 60);
      const m = Math.round(livePreview.durationMin % 60);
      const dur = h ? `${h}t ${m}min` : `${m}min`;
      return `${livePreview.distanceKm} km · ${dur}${livePreview.pending ? " · oppdaterer…" : ""}`;
    }
    if (mapPoints.length >= 2) return `${mapPoints.length} punkter · beregner rute…`;
    return selectedVehicle ? `${styleMeta(style).label} · ${selectedVehicle.name}` : undefined;
  })();

  if (generating) {
    return (
      <div className="py-12 max-w-2xl mx-auto text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="mt-5 font-display text-2xl uppercase">{w.manual.generating}</p>
      </div>
    );
  }

  return (
    <PlannerWorkspace
      points={mapPoints}
      summary={mapSummary}
      routeGeometry={livePreview?.geometry}
    >

    <div className="py-4 md:py-8 max-w-2xl mx-auto pb-32 md:pb-12 lg:py-0 lg:max-w-none lg:pb-12">

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
            const last = validRows[validRows.length - 1];
            if (!originPlace || !last?.place) return null;
            const km = haversineKm(
              { lat: originPlace.lat, lng: originPlace.lng },
              { lat: last.place.lat, lng: last.place.lng },
            );
            if (km >= 5) return null;
            return (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                ✓ Rundtur detektert — slutter der den startet
              </div>
            );
          })()}

          <div className="mt-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
            <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-primary">
              📍 Avreisested
            </span>
            <PlaceAutocomplete
              value={originText}
              onTextChange={(v) => { setOriginText(v); if (errors.origin) setErrors((e) => ({ ...e, origin: undefined })); }}
              selected={originPlace}
              onSelect={setOriginPlace}
              placeholder="Hvor starter turen?"
              useAnywayLabel="Bruk mitt avreisested"
            />
            <button
              type="button"
              onClick={useMyLocationAsOrigin}
              disabled={originLocating}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              {originLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "📍"} Bruk min posisjon
            </button>
            {errors.origin && (
              <p className="text-[11px] font-semibold text-destructive">{errors.origin}</p>
            )}
          </div>

          {viaRows.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                Stopp og destinasjoner underveis
              </p>
              {viaRows.map((r, idx) => {
                const tp = detectType(r.text, r.type);
                const isDest = r.kind === "destination";
                const icon = isDest ? "🏁" : tp === "lodging" ? "🏨" : "🏙️";
                return (
                  <div
                    key={r.key}
                    className={cn(
                      "rounded-2xl border bg-surface p-3 space-y-2",
                      isDest ? "border-primary/40 bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <PlaceAutocomplete
                          value={r.text}
                          onTextChange={(v) => updateRow(r.key, { text: v })}
                          selected={r.place}
                          onSelect={(p) => updateRow(r.key, { place: p })}
                          placeholder={isDest ? "Neste destinasjon" : w.manual.placeholder}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        className="p-2 text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={w.manual.removeStop}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-7 text-[11px] text-muted-foreground">
                      <span>{isDest ? `Destinasjon ${idx + 1}` : `Via-stopp ${idx + 1}`}</span>
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.key, { date: e.target.value })}
                        className="ml-auto bg-background border border-border rounded-md px-2 py-1 text-[11px]"
                        aria-label={w.manual.dateLabel}
                      />
                      <button
                        type="button"
                        onClick={() => updateRow(r.key, { kind: isDest ? "via" : "destination" })}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] hover:border-primary"
                      >
                        {isDest ? "🏁 Destinasjon" : "🛣️ Via-stopp"}
                      </button>


                      <button
                        type="button"
                        onClick={() => updateRow(r.key, { type: tp === "lodging" ? "city" : "lodging" })}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] hover:border-primary"
                      >
                        {tp === "lodging" ? "🏨 Overnatting" : "🏙️ Stopp"}
                      </button>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {destinationRow && (
            <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-primary">
                  🏁 Destinasjon
                </span>
                <input
                  type="date"
                  value={destinationRow.date}
                  onChange={(e) => updateRow(destinationRow.key, { date: e.target.value })}
                  className="bg-background border border-border rounded-md px-2 py-1 text-[11px]"
                  aria-label={w.manual.dateLabel}
                />
              </div>
              <PlaceAutocomplete
                value={destinationRow.text}
                onTextChange={(v) => { updateRow(destinationRow.key, { text: v }); if (errors.destination) setErrors((e) => ({ ...e, destination: undefined })); }}
                selected={destinationRow.place}
                onSelect={(p) => updateRow(destinationRow.key, { place: p })}
                placeholder="Hvor skal du?"
                useAnywayLabel="Bruk min destinasjon"
              />
              {errors.destination && (
                <p className="text-[11px] font-semibold text-destructive">{errors.destination}</p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={insertViaStop}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-border bg-surface px-4 py-2 text-sm hover:border-primary hover:text-primary"
              title="Et raskt stopp underveis på samme etappe"
            >
              <Plus className="h-4 w-4" /> Legg til via-stopp
            </button>
            <button
              type="button"
              onClick={insertNextDestination}
              className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
              title="En ny hoveddestinasjon — får sin egen dag/etappe i roadbooken"
            >
              <Plus className="h-4 w-4" /> Legg til neste destinasjon
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-primary hover:text-primary"
            >
              <FileText className="h-4 w-4" /> {w.manual.importButton}
            </button>
          </div>


          <div className="mt-10 sticky bottom-24 md:bottom-0 md:static">
            <button
              type="button"
              onClick={() => {
                const next: typeof errors = {};
                if (!hasOrigin) next.origin = "Velg avreisested";
                if (!hasDestination) next.destination = "Velg destinasjon";
                if (next.origin || next.destination) { setErrors(next); return; }
                setErrors({});
                setStep(2);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              Fortsett til kjøretøy og stil <ArrowRight className="h-5 w-5" strokeWidth={3} />
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
                <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Ruten beregnes med kartdata. Veiglede bruker stilvalget til å påvirke stopp, dagsetapper og unngå motorvei der mulig.
          </p>


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
              <Sparkles className="h-5 w-5" /> Beregn og bygg roadbook
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
    </PlannerWorkspace>
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
