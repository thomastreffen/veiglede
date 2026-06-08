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
    return { token: `${s.lat},${s.lng}`, label: s.name || s.location || `${s.lat},${s.lng}` };
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

  const { gmaps, amaps, waze, shareUrl, shareText, copyText, totalCount, lastStop } = useMemo(() => {
    const originWP: WP = { token: encodeURIComponent(origin), label: origin };
    const destWP: WP = { token: encodeURIComponent(destination), label: destination };

    // Intermediate stops only (exclude origin/destination duplicates handled by caller).
    const intermediate = stops
      .map(stopToWP)
      .filter((w): w is WP => !!w);

    // Google Maps max 9 waypoints between origin & destination.
    const limitedStops = pickWaypoints(stops, 9);
    const gmapsWPs = limitedStops.map(stopToWP).filter((w): w is WP => !!w);

    const gmapsParts = [originWP.token, ...gmapsWPs.map((w) => w.token), destWP.token];
    const gmaps = `https://www.google.com/maps/dir/${gmapsParts.join("/")}`;

    const appleBase = isIos() ? "maps://" : "https://maps.apple.com/";
    const appleParams = [
      `saddr=${originWP.token}`,
      ...gmapsWPs.map((w) => `daddr=${w.token}`),
      `daddr=${destWP.token}`,
    ].join("&");
    const amaps = `${appleBase}?${appleParams}`;

    const last = stops[stops.length - 1];
    const waze =
      last && typeof last.lat === "number" && typeof last.lng === "number"
        ? `https://waze.com/ul?ll=${last.lat},${last.lng}&navigate=yes`
        : `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`;

    const chain = [originWP.label, ...intermediate.map((w) => w.label), destWP.label].join(" → ");
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
      lastStop: last,
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
          <a
            href={gmaps}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm hover:bg-surface-2 hover:text-primary border-b border-border/60"
          >
            <div className="font-medium">🗺️ Google Maps</div>
            <div className="text-xs text-muted-foreground mt-0.5">{countLabel}</div>
            {totalCount > 9 && (
              <div className="text-xs text-amber-400 mt-0.5">Google Maps maks 9 stopp — resten hoppes over</div>
            )}
          </a>
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
