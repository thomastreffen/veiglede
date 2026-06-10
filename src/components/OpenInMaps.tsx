import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { toast } from "sonner";
import { useTripTracking } from "@/lib/trip-tracking";

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

function isMobile() {
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

/** Destination-only Google Maps URL — opens the native Start flow on mobile. */
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

/** Destination-only Apple Maps URL — current location as origin. */
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
  const ref = useRef<HTMLDivElement>(null);
  const tracking = useTripTracking(tripId ?? "__none__");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Determine the "next stop" for active navigation — skip departure/start markers.
  const nextStop = useMemo<StopLike | null>(() => {
    const isDeparture = (s: StopLike) => {
      const t = (s.type ?? "").toLowerCase();
      if (t === "departure" || t === "start" || t === "origin") return true;
      const name = (s.name ?? "").trim().toLowerCase();
      return /^(avgang|departure|start)\b/.test(name);
    };
    const candidates = stops.filter((s) => s.type !== "pause" && !isDeparture(s));
    if (candidates.length === 0) return null;
    const visited = new Set(tracking?.visitedStopIds ?? []);
    const next = candidates.find((s) => !s.id || !visited.has(s.id));
    return next ?? candidates[candidates.length - 1] ?? null;
  }, [stops, tracking?.visitedStopIds]);

  const hasNext = !!nextStop;
  const nextLabel = nextStop?.name || nextStop?.location || "";
  const navGmaps = nextStop ? gmapsNavigateUrl(nextStop, destination) : "";
  const navAmaps = nextStop ? amapsNavigateUrl(nextStop, destination) : "";
  const navWaze = nextStop
    ? (typeof nextStop.lat === "number" && typeof nextStop.lng === "number"
        ? `https://waze.com/ul?ll=${nextStop.lat},${nextStop.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(nextStop.location || nextStop.name || "")}&navigate=yes`)
    : "";

  // Start from planned origin → next real stop
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


  const { gmaps, amaps, waze, shareUrl, shareText, copyText, totalCount } = useMemo(() => {
    const isRoundTrip = origin === destination && stops.length > 0;
    const firstStopWP = isRoundTrip ? stopToWP(stops[0]) : null;
    const originToken = firstStopWP?.token ?? encodeURIComponent(origin);
    const originLabel = firstStopWP?.label ?? origin;

    const lastLodgingStop = isRoundTrip
      ? [...stops].reverse().find((s) => s.type === "lodging")
      : null;
    const effectiveLastStop =
      lastLodgingStop ?? (isRoundTrip ? stops[stops.length - 2] : stops[stops.length - 1]);

    const last = stops[stops.length - 1];
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

    void last;
    const waze =
      last && typeof last.lat === "number" && typeof last.lng === "number"
        ? `https://waze.com/ul?ll=${last.lat},${last.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(destLabel)}&navigate=yes`;

    const chain = [originLabel, ...intermediate.map((w) => w.label), destLabel].join(" → ");
    const copyText = `Veiglede-rute: ${chain}`;
    const shareText = distanceKm ? `${chain} (${Math.round(distanceKm)} km)` : chain;

    return {
      gmaps,
      amaps,
      waze,
      shareUrl: gmaps,
      shareText,
      copyText,
      totalCount: intermediate.length,
    };
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

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function" && isMobile();
  const tooManyWaypoints = totalCount > 9;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-5 py-3.5 text-sm font-medium hover:bg-surface-2 hover:border-primary"
      >
        <Navigation className="h-4 w-4" /> Naviger →
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-2 z-50 min-w-[16rem] w-max max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          {/* Primary: Naviger til neste stopp */}
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2/50 border-b border-border/60">
            Naviger til neste stopp
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/60">
            {hasNext ? (
              <>Neste stopp: <span className="text-foreground/90 font-medium">{nextLabel}</span></>
            ) : (
              <span className="text-amber-400">Ingen neste stopp</span>
            )}
          </div>

          {hasNext ? (
            <>
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Start fra nåværende posisjon
              </div>
              <a
                href={navGmaps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
              >
                <div className="font-medium">🧭 Google Maps</div>
                <div className="text-xs text-muted-foreground mt-0.5">Bruker din nåværende posisjon</div>
              </a>
              <a
                href={navAmaps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
              >
                <div className="font-medium">🧭 Apple Kart</div>
                <div className="text-xs text-muted-foreground mt-0.5">Bruker din nåværende posisjon</div>
              </a>
              <a
                href={navWaze}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
              >
                <div className="font-medium">🧭 Waze</div>
                <div className="text-xs text-muted-foreground mt-0.5">Bruker din nåværende posisjon</div>
              </a>

              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 border-t border-border/60">
                Start fra turens startadresse
              </div>
              <a
                href={fromOriginGmaps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
              >
                <div className="font-medium">📍 Google Maps</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">Fra {origin}</div>
              </a>
              <a
                href={fromOriginAmaps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
              >
                <div className="font-medium">📍 Apple Kart</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">Fra {origin}</div>
              </a>
            </>
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground border-b border-border/60">
              Legg til et reelt stopp for å starte navigasjon.
            </div>
          )}


          {/* Secondary: route overview */}
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2/50 border-b border-t border-border/60">
            Ruteoversikt (forhåndsvisning)
          </div>
          {tooManyWaypoints && (
            <div className="px-4 py-2 text-[11px] text-amber-400 border-b border-border/60">
              Kartapper kan begrense antall stopp. For navigasjon anbefales neste stopp.
            </div>
          )}
          <a
            href={gmaps}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">🗺️ Åpne ruteoversikt i Google Maps</div>
            <div className="text-xs text-muted-foreground mt-0.5">Forhåndsvisning av hele ruten</div>
          </a>
          <a
            href={amaps}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">🗺️ Åpne ruteoversikt i Apple Kart</div>
            <div className="text-xs text-muted-foreground mt-0.5">Forhåndsvisning av hele ruten</div>
          </a>
          <a
            href={waze}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">🧭 Waze</div>
            <div className="text-xs text-muted-foreground mt-0.5">Åpner til destinasjon</div>
          </a>

          {/* Utilities */}
          {onDownloadGpx && (
            <button
              type="button"
              onClick={() => { onDownloadGpx(); setOpen(false); }}
              className="block w-full text-left px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
            >
              <div className="font-medium">📍 Eksporter GPX</div>
              <div className="text-xs text-muted-foreground mt-0.5">Best for BMW Motorrad, Garmin, TomTom og andre.</div>
            </button>
          )}
          {roadbookHref && (
            <a
              href={roadbookHref}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
            >
              <div className="font-medium">📖 Roadbook</div>
              <div className="text-xs text-muted-foreground mt-0.5">Best for oversikt og deling.</div>
            </a>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="block w-full text-left px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">📋 Kopier stopp</div>
            <div className="text-xs text-muted-foreground mt-0.5">Lim inn i valgfri app</div>
          </button>
          {canShare && (
            <button
              type="button"
              onClick={handleShare}
              className="block w-full text-left px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary"
            >
              <div className="font-medium">📤 Del rute</div>
              <div className="text-xs text-muted-foreground mt-0.5">WhatsApp, Messages …</div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
