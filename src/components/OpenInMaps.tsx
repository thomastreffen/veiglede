import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation, X } from "lucide-react";
import { toast } from "sonner";
import { useTripTracking } from "@/lib/trip-tracking";
import { useIsMobile } from "@/hooks/use-mobile";

interface StopLike {
  id?: string;
  name?: string;
  location?: string;
  lat?: number;
  lng?: number;
  type?: string;
}

interface Props {
  origin: string;
  destination: string;
  stops?: StopLike[];
  tripTitle?: string;
  tripId?: string;
  distanceKm?: number;
  onDownloadGpx?: () => void;
  roadbookHref?: string;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

type WP = { token: string; label: string };

function stopToWP(s: StopLike, preferText = false): WP | null {
  if (!preferText && typeof s.lat === "number" && typeof s.lng === "number") {
    const lat = Math.round(s.lat * 1e6) / 1e6;
    const lng = Math.round(s.lng * 1e6) / 1e6;
    return { token: `${lat},${lng}`, label: s.name || s.location || `${lat},${lng}` };
  }
  const loc = s.location || s.name;
  if (loc && loc.trim()) {
    return { token: encodeURIComponent(loc.trim()), label: loc.trim() };
  }
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    const lat = Math.round(s.lat * 1e6) / 1e6;
    const lng = Math.round(s.lng * 1e6) / 1e6;
    return { token: `${lat},${lng}`, label: `${lat},${lng}` };
  }
  return null;
}

function pickWaypoints(stops: StopLike[], max: number): StopLike[] {
  if (stops.length <= max) return stops;
  const indexed = stops.map((s, i) => ({ s, i }));
  const priority = (t?: string) => (t === "lodging" ? 0 : t === "ferry" ? 1 : 2);
  const picked = [...indexed]
    .sort((a, b) => priority(a.s.type) - priority(b.s.type) || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  return picked;
}

function gmapsNavigateUrl(s: StopLike, destinationFallback?: string): string {
  let dest = "";
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    dest = `${Math.round(s.lat * 1e6) / 1e6},${Math.round(s.lng * 1e6) / 1e6}`;
  } else {
    const txt = (s.location || s.name || destinationFallback || "").trim();
    dest = encodeURIComponent(txt);
  }
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${dest}`;
}

function amapsNavigateUrl(s: StopLike, destinationFallback?: string): string {
  let dest = "";
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    dest = `${Math.round(s.lat * 1e6) / 1e6},${Math.round(s.lng * 1e6) / 1e6}`;
  } else {
    const txt = (s.location || s.name || destinationFallback || "").trim();
    dest = encodeURIComponent(txt);
  }
  const base = isIos() ? "maps://" : "https://maps.apple.com/";
  return `${base}?daddr=${dest}&dirflg=d`;
}

export function OpenInMaps({ origin, destination, stops = [], tripTitle, tripId, distanceKm, onDownloadGpx, roadbookHref }: Props) {
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tracking = useTripTracking(tripId ?? "__none__");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) {
      setShowMore(false);
      return;
    }
    if (isMobile) return; // mobile uses backdrop, not outside click
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, isMobile]);

  const nextStop = useMemo<StopLike | null>(() => {
    const norm = (v?: string) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const originNorm = norm(origin);
    const originFirstPart = norm(origin.split(/[,|]/)[0]);
    const isDeparture = (s: StopLike) => {
      const t = (s.type ?? "").toLowerCase();
      if (t === "pause") return true;
      if (t === "departure" || t === "start" || t === "origin") return true;
      const name = norm(s.name);
      const loc = norm(s.location);
      if (/^(avgang|departure|start)\b/.test(name)) return true;
      if (originNorm && (name === originNorm || loc === originNorm)) return true;
      if (originFirstPart && (name.includes(originFirstPart) || loc.includes(originFirstPart))) {
        const idx = stops.indexOf(s);
        if (idx >= 0 && idx <= 1) return true;
      }
      return false;
    };
    const candidates = stops.filter((s) => !isDeparture(s));
    if (candidates.length === 0) return null;
    const visited = new Set(tracking?.visitedStopIds ?? []);
    const next = candidates.find((s) => !s.id || !visited.has(s.id));
    return next ?? null;
  }, [stops, tracking?.visitedStopIds, origin]);

  const hasNext = !!nextStop;
  const nextLabel = nextStop?.name || nextStop?.location || "";
  const navGmaps = nextStop ? gmapsNavigateUrl(nextStop, destination) : "";
  const navAmaps = nextStop ? amapsNavigateUrl(nextStop, destination) : "";
  const navWaze = nextStop
    ? (typeof nextStop.lat === "number" && typeof nextStop.lng === "number"
        ? `https://waze.com/ul?ll=${nextStop.lat},${nextStop.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(nextStop.location || nextStop.name || "")}&navigate=yes`)
    : "";

  const fromOriginGmaps = nextStop
    ? `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${
        typeof nextStop.lat === "number" && typeof nextStop.lng === "number"
          ? `${Math.round(nextStop.lat * 1e6) / 1e6},${Math.round(nextStop.lng * 1e6) / 1e6}`
          : encodeURIComponent(nextStop.location || nextStop.name || "")
      }`
    : "";
  const fromOriginAmaps = nextStop
    ? `${isIos() ? "maps://" : "https://maps.apple.com/"}?saddr=${encodeURIComponent(origin)}&daddr=${
        typeof nextStop.lat === "number" && typeof nextStop.lng === "number"
          ? `${Math.round(nextStop.lat * 1e6) / 1e6},${Math.round(nextStop.lng * 1e6) / 1e6}`
          : encodeURIComponent(nextStop.location || nextStop.name || "")
      }&dirflg=d`
    : "";

  const { gmaps, amaps, shareUrl, shareText, copyText } = useMemo(() => {
    const isRoundTrip = origin === destination && stops.length > 0;
    const firstStopWP = isRoundTrip ? stopToWP(stops[0]) : null;
    const originToken = firstStopWP?.token ?? encodeURIComponent(origin);
    const originLabel = firstStopWP?.label ?? origin;

    const lastLodgingStop = isRoundTrip
      ? [...stops].reverse().find((s) => s.type === "lodging")
      : null;
    const effectiveLastStop =
      lastLodgingStop ?? (isRoundTrip ? stops[stops.length - 2] : stops[stops.length - 1]);

    const effectiveLastWP = effectiveLastStop ? stopToWP(effectiveLastStop, true) : null;
    const effectiveDestination = isRoundTrip && effectiveLastWP
      ? effectiveLastWP.token
      : encodeURIComponent(destination);
    const destLabel = isRoundTrip ? effectiveLastWP?.label ?? destination : destination;

    const effectiveLastIndex = effectiveLastStop ? stops.lastIndexOf(effectiveLastStop) : -1;
    const intermediateStops = (isRoundTrip
      ? stops.slice(1, effectiveLastIndex >= 0 ? effectiveLastIndex : stops.length - 1)
      : stops).filter((s) => s.type !== "pause");

    const navigationStops = intermediateStops.filter((s) => s.type === "lodging");
    const intermediate = navigationStops
      .map((s) => stopToWP(s, true))
      .filter((w): w is WP => !!w);

    const limitedStops = pickWaypoints(navigationStops, 9);
    const gmapsWPs = limitedStops
      .map((s) => {
        if (typeof s.lat === "number" && typeof s.lng === "number") {
          const lat = Math.round(s.lat * 1e6) / 1e6;
          const lng = Math.round(s.lng * 1e6) / 1e6;
          return { token: `${lat},${lng}`, label: s.name || s.location || "" };
        }
        const loc = (s.location || s.name || "").split(/[,|]/)[0].trim();
        return loc ? { token: encodeURIComponent(loc), label: loc } : null;
      })
      .filter((w): w is WP => !!w);

    const gmapsParts = [originToken, ...gmapsWPs.map((w) => w.token), effectiveDestination];
    const gmaps = `https://www.google.com/maps/dir/${gmapsParts.join("/")}`;

    const appleBase = isIos() ? "maps://" : "https://maps.apple.com/";
    const appleParams = [
      `saddr=${originToken}`,
      ...gmapsWPs.map((w) => `daddr=${w.token}`),
      `daddr=${effectiveDestination}`,
    ].join("&");
    const amaps = `${appleBase}?${appleParams}`;

    const chain = [originLabel, ...intermediate.map((w) => w.label), destLabel].join(" → ");
    const copyText = `Veiglede-rute: ${chain}`;
    const shareText = distanceKm ? `${chain} (${Math.round(distanceKm)} km)` : chain;

    return { gmaps, amaps, shareUrl: gmaps, shareText, copyText };
  }, [origin, destination, stops, distanceKm]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      toast.success("Stopp kopiert!", { description: "Lim inn i valgfri navigasjonsapp." });
    } catch {
      toast.error("Kunne ikke kopiere");
    }
    setOpen(false);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: tripTitle ? `${tripTitle} — Veiglede` : "Veiglede-rute",
        text: shareText,
        url: shareUrl,
      });
    } catch {
      /* user cancelled or unsupported */
    }
    setOpen(false);
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function" && isMobileUA();
  const close = () => setOpen(false);

  // ---- Menu content (shared between mobile sheet and desktop dropdown) ----
  const primaryBtnBase =
    "flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors";

  const PrimarySection = (
    <div className="px-4 pt-4 pb-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Naviger til neste stopp
      </div>
      <div className="mt-1 text-sm">
        {hasNext ? (
          <>Neste stopp: <span className="font-medium text-foreground">{nextLabel}</span></>
        ) : (
          <span className="text-amber-400">Ingen neste stopp</span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <a
          href={hasNext ? navAmaps : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={hasNext ? close : (e) => e.preventDefault()}
          aria-disabled={!hasNext}
          className={`${primaryBtnBase} ${
            hasNext
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-surface-2 text-muted-foreground pointer-events-none opacity-50"
          }`}
        >
          🧭 Start i Apple Kart
        </a>
        <a
          href={hasNext ? navGmaps : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={hasNext ? close : (e) => e.preventDefault()}
          aria-disabled={!hasNext}
          className={`${primaryBtnBase} ${
            hasNext
              ? "border border-border bg-surface hover:bg-surface-2 hover:border-primary"
              : "bg-surface-2 text-muted-foreground pointer-events-none opacity-50"
          }`}
        >
          🧭 Start i Google Maps
        </a>
        <a
          href={hasNext ? navWaze : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={hasNext ? close : (e) => e.preventDefault()}
          aria-disabled={!hasNext}
          className={`${primaryBtnBase} ${
            hasNext
              ? "border border-border bg-surface hover:bg-surface-2 hover:border-primary"
              : "bg-surface-2 text-muted-foreground pointer-events-none opacity-50"
          }`}
        >
          🧭 Start i Waze
        </a>
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        {showMore ? "Skjul valg" : "Flere valg"}
      </button>
    </div>
  );

  const itemCls =
    "block w-full text-left px-4 py-2.5 text-sm hover:bg-surface-2 hover:text-primary";
  const groupHeader =
    "px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70";

  const SecondarySection = showMore ? (
    <div className="border-t border-border/60 pb-3">
      {hasNext && (
        <>
          <div className={groupHeader}>Fra turens startadresse</div>
          <a href={fromOriginGmaps} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
            📍 Google Maps
          </a>
          <a href={fromOriginAmaps} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
            📍 Apple Kart
          </a>
        </>
      )}

      <div className={groupHeader}>Ruteoversikt</div>
      <a href={gmaps} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
        🗺️ Google Maps
      </a>
      <a href={amaps} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
        🗺️ Apple Kart
      </a>

      <div className={groupHeader}>Annet</div>
      {onDownloadGpx && (
        <button type="button" onClick={() => { onDownloadGpx(); close(); }} className={itemCls}>
          📍 Eksporter GPX
        </button>
      )}
      {roadbookHref && (
        <a href={roadbookHref} onClick={close} className={itemCls}>
          📖 Roadbook
        </a>
      )}
      <button type="button" onClick={handleCopy} className={itemCls}>
        📋 Kopier stopp
      </button>
      {canShare && (
        <button type="button" onClick={handleShare} className={itemCls}>
          📤 Del rute
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3.5 text-sm font-medium hover:bg-surface-2 hover:border-primary"
      >
        <Navigation className="h-4 w-4" /> Naviger →
      </button>

      {open && isMobile && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={close}
            aria-hidden
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface shadow-2xl"
            style={{ maxHeight: "75vh" }}
            role="dialog"
            aria-label="Naviger"
          >
            <div className="flex items-center justify-between px-4 pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-border" />
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Lukk"
              className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(75vh - 12px)" }}>
              {PrimarySection}
              {SecondarySection}
            </div>
          </div>
        </>
      )}

      {open && !isMobile && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-[20rem] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto">
            {PrimarySection}
            {SecondarySection}
          </div>
        </div>
      )}
    </div>
  );
}
