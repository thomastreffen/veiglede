// Shared DOM helpers for the live position marker.
// Used by both the owner trip map (MapLibreTripMap) and the public follower
// map (LiveTripMap) so the marker looks identical in both places.

export type LiveMarkerVehicle =
  | "car"
  | "motorcycle"
  | "mc"
  | "rv"
  | "camper"
  | "motorhome"
  | "bicycle"
  | "bike"
  | string;

export type LiveMarkerPhase = "active" | "paused" | "ended";

/** Map a vehicle type to an emoji icon. Returns null when there's no match. */
export function vehicleEmoji(vehicle?: string | null): string | null {
  if (!vehicle) return null;
  const v = vehicle.toLowerCase();
  if (v === "car" || v === "bil") return "🚗";
  if (v === "motorcycle" || v === "mc" || v === "motorsykkel") return "🏍️";
  if (v === "rv" || v === "camper" || v === "motorhome" || v === "bobil") return "🚐";
  if (v === "bicycle" || v === "bike" || v === "sykkel") return "🚲";
  return null;
}

/** Inject the shared pulse keyframes exactly once. */
function ensurePulseKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById("vg-live-marker-kf")) return;
  const style = document.createElement("style");
  style.id = "vg-live-marker-kf";
  style.textContent = `
@keyframes vgLiveMarkerPulse {
  0%   { transform: scale(.6); opacity: .8; }
  100% { transform: scale(2.0); opacity: 0; }
}
`;
  document.head.appendChild(style);
}

/**
 * Build a DOM element for the live position marker. When `vehicle` maps to a
 * known emoji we render a vehicle badge; otherwise we fall back to the classic
 * blue dot with optional heading arrow.
 */
export function createLiveMarkerEl(
  vehicle?: string | null,
  opts?: { phase?: LiveMarkerPhase; title?: string },
): HTMLElement {
  ensurePulseKeyframes();
  const phase: LiveMarkerPhase = opts?.phase ?? "active";
  const emoji = vehicleEmoji(vehicle);

  const wrap = document.createElement("div");
  wrap.className = "vg-live-marker";
  wrap.dataset.phase = phase;
  wrap.title = opts?.title ?? "Live posisjon";
  wrap.style.cssText = `
    position: relative;
    width: ${emoji ? 44 : 28}px;
    height: ${emoji ? 44 : 28}px;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  `;

  // Color tokens per phase.
  const bg =
    phase === "paused" ? "#eab308" :
    phase === "ended" ? "#6b7280" :
    emoji ? "#f59e3a" : "#3b82f6";
  const pulseColor =
    phase === "paused" ? "rgba(234,179,8,.35)" :
    phase === "ended" ? "transparent" :
    emoji ? "rgba(245,158,58,.45)" : "rgba(59,130,246,.35)";

  // Pulse halo.
  const pulse = document.createElement("div");
  pulse.className = "vg-live-marker__pulse";
  pulse.style.cssText = `
    position: absolute; inset: 0; border-radius: 9999px;
    background: ${pulseColor};
    ${phase === "active" ? "animation: vgLiveMarkerPulse 1.6s ease-out infinite;" : ""}
  `;
  wrap.appendChild(pulse);

  // Badge / dot.
  const dot = document.createElement("div");
  dot.className = "vg-live-marker__dot";
  if (emoji) {
    dot.style.cssText = `
      position: relative;
      width: 36px; height: 36px;
      border-radius: 9999px;
      background: ${bg};
      border: 3px solid #fff;
      box-shadow: 0 4px 12px rgba(0,0,0,.45);
      display: grid; place-items: center;
      font-size: 20px; line-height: 1;
    `;
    dot.textContent = emoji;
  } else {
    dot.style.cssText = `
      position: relative;
      width: 18px; height: 18px;
      border-radius: 9999px;
      background: ${bg};
      border: 3px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,.45);
    `;
  }
  wrap.appendChild(dot);

  return wrap;
}
