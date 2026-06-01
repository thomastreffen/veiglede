import type { Trip, Stop } from "@/lib/trips-store";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildGpx(trip: Trip, stops: Stop[]): string {
  const pts = stops.filter((s) => typeof s.lat === "number" && typeof s.lng === "number");
  const rtepts = pts
    .map(
      (s) =>
        `    <rtept lat="${s.lat}" lon="${s.lng}">\n      <name>${esc(s.name)}</name>${
          s.description ? `\n      <desc>${esc(s.description)}</desc>` : ""
        }\n      <sym>${esc(s.type)}</sym>\n    </rtept>`,
    )
    .join("\n");
  const desc = [trip.subtitle, trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : ""]
    .filter(Boolean)
    .join(" — ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Veiglede" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(trip.title)}</name>${desc ? `\n    <desc>${esc(desc)}</desc>` : ""}
  </metadata>
  <rte>
    <name>${esc(trip.title)}</name>
${rtepts}
  </rte>
</gpx>
`;
}

export function downloadGpx(trip: Trip, stops: Stop[]) {
  const xml = buildGpx(trip, stops);
  const slug = trip.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "tur";
  const blob = new Blob([xml], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-veiglede.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
