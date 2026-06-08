import { useEffect, useMemo, useRef, useState } from "react";
import { Navigation } from "lucide-react";
import { toast } from "sonner";

interface StopLike {
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
  distanceKm?: number;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** A waypoint usable in a maps URL. */
type WP = { token: string; label: string };

function stopToWP(s: StopLike): WP | null {
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    const lat = Math.round(s.lat * 1e6) / 1e6;
    const lng = Math.round(s.lng * 1e6) / 1e6;
    return { token: `${lat},${lng}`, label: s.name || s.location || `${lat},${lng}` };
  }
  const loc = s.location || s.name;
  if (loc && loc.trim()) {
    return { token: encodeURIComponent(loc.trim()), label: loc.trim() };
  }
  return null;
}

/** Pick at most `max` waypoints. Prioritise lodging + ferry, then keep order. */
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

export function OpenInMaps({ origin, destination, stops = [], tripTitle, distanceKm }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const { gmapsWebUrl, gmapsDeepLink, amaps, waze, shareUrl, shareText, copyText, totalCount, lastStop } = useMemo(() => {
    const isRoundTrip = origin === destination && stops.length > 0;
    const firstStopWP = isRoundTrip ? stopToWP(stops[0]) : null;
    const lastStopWP = isRoundTrip ? stopToWP(stops[stops.length - 1]) : null;

    const originToken = firstStopWP?.token ?? encodeURIComponent(origin);
    const originLabel = firstStopWP?.label ?? origin;

    const last = stops[stops.length - 1];
    const effectiveDestination =
      origin === destination && stops.length > 0
        ? last.location || last.name
          ? encodeURIComponent(last.location || last.name || destination)
          : stopToWP(last)?.token ?? encodeURIComponent(destination)
        : encodeURIComponent(destination);

    const destLabel = lastStopWP?.label ?? destination;

    // Intermediate stops: when round-trip, drop first and last (used as origin/dest).
    const intermediateStops = isRoundTrip ? stops.slice(1, -1) : stops;

    const intermediate = intermediateStops
      .map(stopToWP)
      .filter((w): w is WP => !!w);

    // Google Maps max 9 waypoints between origin & destination.
    const limitedStops = pickWaypoints(intermediateStops, 9);
    const gmapsWPs = limitedStops.map(stopToWP).filter((w): w is WP => !!w);

    const gmapsParts = [originToken, ...gmapsWPs.map((w) => w.token), effectiveDestination];
    const gmapsWebUrl = `https://www.google.com/maps/dir/${gmapsParts.join("/")}`;
    const gmapsDeepLink = `comgooglemaps://?saddr=${originToken}&daddr=${effectiveDestination}${
      gmapsWPs.length > 0 ? `&waypoints=${gmapsWPs.map((w) => w.token).join("|")}` : ""
    }&directionsmode=driving`;

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
      gmapsWebUrl,
      gmapsDeepLink,
      amaps,
      waze,
      shareUrl: gmapsWebUrl,
      shareText,
      copyText,
      totalCount: intermediate.length,
      lastStop: last,
    };
  }, [origin, destination, stops, distanceKm]);

  const handleGmaps = () => {
    if (isIos()) {
      window.location.href = gmapsDeepLink;
      setTimeout(() => {
        window.location.href = gmapsWebUrl;
      }, 1500);
    } else {
      window.open(gmapsWebUrl, "_blank");
    }
    setOpen(false);
  };

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
  const countLabel = totalCount > 0 ? `Åpner med alle ${totalCount + 2} stopp` : "Åpner rute";
  // count + 2 includes origin & destination for user-facing total
  void lastStop;

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
        <div className="absolute right-0 bottom-full mb-2 z-50 w-64 rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={handleGmaps}
            className="block w-full text-left px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">🗺️ Google Maps</div>
            <div className="text-xs text-muted-foreground mt-0.5">{countLabel}</div>
            {totalCount > 9 && (
              <div className="text-xs text-amber-400 mt-0.5">Google Maps maks 9 stopp — resten hoppes over</div>
            )}
          </button>
          <a
            href={amaps}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">🍎 Apple Maps</div>
            <div className="text-xs text-muted-foreground mt-0.5">{countLabel}</div>
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
