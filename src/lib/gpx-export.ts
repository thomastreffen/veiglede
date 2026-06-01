import type { Trip, Stop } from "@/lib/trips-store";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SYM_MAP: Record<string, string> = {
  viewpoint: "Scenic Area",
  food: "Restaurant",
  fuel: "Gas Station",
  lodging: "Lodging",
  attraction: "Attraction",
  rest: "Restroom",
  photo: "Scenic Area",
};
const symFor = (type: string) => SYM_MAP[type] ?? "Waypoint";

const truncate = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function buildGpx(trip: Trip, stops: Stop[]): string {
  const pts = stops.filter((s) => typeof s.lat === "number" && typeof s.lng === "number");
  const rtepts = pts
    .map((s) => {
      const shortName = truncate(s.name, 25);
      const fullDesc = [s.name, s.description].filter(Boolean).join(" — ");
      const sym = symFor(s.type);
      return `    <rtept lat="${s.lat}" lon="${s.lng}">
      <name>${esc(shortName)}</name>
      <desc>${esc(fullDesc)}</desc>
      <sym>${esc(sym)}</sym>
      <type>${esc(sym)}</type>
    </rtept>`;
    })
    .join("\n");

  const desc = [trip.subtitle, trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : ""]
    .filter(Boolean)
    .join(" — ");

  const geom = trip.routeGeometry ?? [];
  const trkseg =
    geom.length > 1
      ? `  <trk>
    <name>${esc(trip.title)}</name>
    <trkseg>
${geom.map((p) => `      <trkpt lat="${p.lat}" lon="${p.lng}"/>`).join("\n")}
    </trkseg>
  </trk>
`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Veiglede" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(trip.title)}</name>${desc ? `\n    <desc>${esc(desc)}</desc>` : ""}
  </metadata>
  <rte>
    <name>${esc(trip.title)}</name>
${rtepts}
  </rte>
${trkseg}</gpx>
`;
}

export function downloadGpx(trip: Trip, stops: Stop[]) {
  const xml = buildGpx(trip, stops);
  const origin = slugify(trip.origin ?? "");
  const destination = slugify(trip.destination ?? "");
  const base =
    origin && destination
      ? `${origin}-${destination}`
      : slugify(trip.title) || "tur";
  const filename = `${base}-veiglede.gpx`;
  const blob = new Blob([xml], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
