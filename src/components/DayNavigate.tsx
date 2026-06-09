import { Navigation } from "lucide-react";
import type { Stop } from "@/lib/trips-store";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Drop pause stops and internal "Avgang/Ankomst" markers without geo. */
function relevantStops(stops: Stop[]): Stop[] {
  return stops.filter((s) => {
    if (s.timeCategory === "pause") return false;
    const name = (s.name ?? "").trim().toLowerCase();
    const looksInternal = /^(avgang|ankomst|departure|arrival)\b/.test(name);
    const hasGeo = typeof s.lat === "number" && typeof s.lng === "number";
    if (looksInternal && !hasGeo) return false;
    return true;
  });
}

function token(s: Stop, preferText = false): { tok: string; label: string } | null {
  if (!preferText && typeof s.lat === "number" && typeof s.lng === "number") {
    const lat = Math.round(s.lat * 1e6) / 1e6;
    const lng = Math.round(s.lng * 1e6) / 1e6;
    return { tok: `${lat},${lng}`, label: s.name || s.location || `${lat},${lng}` };
  }
  const loc = s.location || s.name;
  if (loc && loc.trim()) {
    const clean = preferText ? loc.split(/[,|]/)[0].trim() : loc.trim();
    return { tok: encodeURIComponent(clean), label: clean };
  }
  if (typeof s.lat === "number" && typeof s.lng === "number") {
    const lat = Math.round(s.lat * 1e6) / 1e6;
    const lng = Math.round(s.lng * 1e6) / 1e6;
    return { tok: `${lat},${lng}`, label: `${lat},${lng}` };
  }
  return null;
}

/** Pick at most `max` intermediate stops, prioritising lodging + ferry + viewpoint. */
function pickWaypoints(stops: Stop[], max: number): Stop[] {
  if (stops.length <= max) return stops;
  const priority = (t?: string) =>
    t === "lodging" ? 0 : t === "ferry" ? 1 : t === "viewpoint" ? 2 : 3;
  return stops
    .map((s, i) => ({ s, i }))
    .sort((a, b) => priority(a.s.type) - priority(b.s.type) || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

export function buildDayNav(stops: Stop[]) {
  const rel = relevantStops(stops);
  if (rel.length < 2) return null;
  const start = token(rel[0], false);
  const end = token(rel[rel.length - 1], true);
  if (!start || !end) return null;
  const middle = pickWaypoints(rel.slice(1, -1), 4)
    .map((s) => token(s, false))
    .filter((t): t is { tok: string; label: string } => !!t);
  const gmapsParts = [start.tok, ...middle.map((m) => m.tok), end.tok];
  const gmaps = `https://www.google.com/maps/dir/${gmapsParts.join("/")}`;
  const appleBase = isIos() ? "maps://" : "https://maps.apple.com/";
  const amaps =
    `${appleBase}?saddr=${start.tok}` +
    middle.map((m) => `&daddr=${m.tok}`).join("") +
    `&daddr=${end.tok}`;
  return { gmaps, amaps, fromLabel: start.label, toLabel: end.label };
}

export function DayNavigate({ stops }: { stops: Stop[] }) {
  const nav = buildDayNav(stops);
  if (!nav) {
    return (
      <div className="mx-4 md:mx-5 mt-3 rounded-xl border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        🛌 Ingen kjøring denne dagen
      </div>
    );
  }
  return (
    <div className="mx-4 md:mx-5 mt-3 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Navigation className="h-3 w-3" /> Naviger dagsetappe
      </div>
      <p className="mt-0.5 text-xs text-foreground/80 truncate">
        {nav.fromLabel} → {nav.toLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={nav.gmaps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
        >
          🗺️ Google Maps
        </a>
        <a
          href={nav.amaps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
        >
          🍎 Apple Maps
        </a>
      </div>
    </div>
  );
}
