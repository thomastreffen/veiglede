// Shared DOM helpers for the live position marker.
// Used by both the owner trip map (MapLibreTripMap) and the public follower
// map (LiveTripMap) so the marker looks identical in both places.

export type LiveMarkerPhase = "active" | "paused" | "ended" | "stale";

export interface LiveMarkerOpts {
  phase?: LiveMarkerPhase;
  /** GPS heading in degrees (0 = north). Null/undefined disables rotation. */
  heading?: number | null;
  /** Speed in km/h. Only shown when > 3. */
  speedKmh?: number | null;
  title?: string;
}

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

function colorsForPhase(phase: LiveMarkerPhase, hasEmoji: boolean) {
  if (phase === "paused") return { bg: "#eab308", pulse: "rgba(234,179,8,.35)" };
  if (phase === "ended") return { bg: "#6b7280", pulse: "transparent" };
  if (phase === "stale") return { bg: "#9ca3af", pulse: "rgba(156,163,175,.25)" };
  return hasEmoji
    ? { bg: "#f59e3a", pulse: "rgba(245,158,58,.45)" }
    : { bg: "#3b82f6", pulse: "rgba(59,130,246,.35)" };
}

/**
 * Build a DOM element for the live position marker. When `vehicle` maps to a
 * known emoji we render a vehicle badge; otherwise we fall back to the classic
 * blue dot. Heading/speed/stale state can be updated later via
 * `updateLiveMarkerEl` without rebuilding the marker.
 */
export function createLiveMarkerEl(
  vehicle?: string | null,
  opts?: LiveMarkerOpts,
): HTMLElement {
  ensurePulseKeyframes();
  const phase: LiveMarkerPhase = opts?.phase ?? "active";
  const emoji = vehicleEmoji(vehicle);

  const wrap = document.createElement("div");
  wrap.className = "vg-live-marker";
  wrap.dataset.phase = phase;
  wrap.dataset.vehicle = vehicle ?? "";
  wrap.dataset.hasEmoji = emoji ? "1" : "0";
  wrap.title = opts?.title ?? "Live posisjon";
  wrap.style.cssText = `
    position: relative;
    width: ${emoji ? 44 : 28}px;
    height: ${emoji ? 44 : 28}px;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    transition: opacity 300ms ease;
  `;

  const { pulse: pulseColor } = colorsForPhase(phase, !!emoji);

  // Pulse halo.
  const pulse = document.createElement("div");
  pulse.className = "vg-live-marker__pulse";
  pulse.style.cssText = `
    position: absolute; inset: 0; border-radius: 9999px;
    background: ${pulseColor};
    ${phase === "active" ? "animation: vgLiveMarkerPulse 1.6s ease-out infinite;" : ""}
  `;
  wrap.appendChild(pulse);

  // Rotor — rotates with heading. Only used when we have a vehicle emoji;
  // the blue fallback dot is intentionally never rotated.
  const rotor = document.createElement("div");
  rotor.className = "vg-live-marker__rotor";
  rotor.style.cssText = `
    position: relative;
    display: grid; place-items: center;
    transform-origin: 50% 50%;
    transition: transform 600ms ease;
  `;
  wrap.appendChild(rotor);

  // Badge / dot.
  const dot = document.createElement("div");
  dot.className = "vg-live-marker__dot";
  const { bg } = colorsForPhase(phase, !!emoji);
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
  rotor.appendChild(dot);

  // Speed pill (hidden by default).
  const speed = document.createElement("div");
  speed.className = "vg-live-marker__speed";
  speed.style.cssText = `
    position: absolute;
    top: 100%; left: 50%;
    transform: translateX(-50%);
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 9999px;
    background: rgba(17,24,39,.85);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: .02em;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0,0,0,.35);
    pointer-events: none;
    display: none;
  `;
  wrap.appendChild(speed);

  updateLiveMarkerEl(wrap, opts);
  return wrap;
}

/**
 * Mutate an existing live marker element in place to reflect new heading,
 * speed, or phase. Cheap: no marker recreation, safe to call on every poll.
 */
export function updateLiveMarkerEl(el: HTMLElement, opts?: LiveMarkerOpts): void {
  const phase: LiveMarkerPhase = opts?.phase ?? (el.dataset.phase as LiveMarkerPhase) ?? "active";
  const hasEmoji = el.dataset.hasEmoji === "1";

  // Phase swap → repaint colors + pulse animation, adjust opacity for stale.
  if (el.dataset.phase !== phase) {
    el.dataset.phase = phase;
  }
  const { bg, pulse } = colorsForPhase(phase, hasEmoji);
  const pulseEl = el.querySelector<HTMLElement>(".vg-live-marker__pulse");
  if (pulseEl) {
    pulseEl.style.background = pulse;
    pulseEl.style.animation =
      phase === "active" ? "vgLiveMarkerPulse 1.6s ease-out infinite" : "none";
  }
  const dotEl = el.querySelector<HTMLElement>(".vg-live-marker__dot");
  if (dotEl) dotEl.style.background = bg;
  el.style.opacity = phase === "stale" ? "0.55" : "1";

  // Rotation (vehicle badge only — never the blue fallback dot).
  const rotor = el.querySelector<HTMLElement>(".vg-live-marker__rotor");
  if (rotor) {
    const heading = opts?.heading;
    if (hasEmoji && typeof heading === "number" && Number.isFinite(heading) && phase !== "stale" && phase !== "ended") {
      rotor.style.transform = `rotate(${heading}deg)`;
    } else {
      rotor.style.transform = "";
    }
  }

  // Speed pill: show only when moving meaningfully and not stale/ended.
  const speedEl = el.querySelector<HTMLElement>(".vg-live-marker__speed");
  if (speedEl) {
    const speedKmh = opts?.speedKmh;
    const show =
      typeof speedKmh === "number" &&
      Number.isFinite(speedKmh) &&
      speedKmh > 3 &&
      phase !== "stale" &&
      phase !== "ended";
    if (show) {
      speedEl.textContent = `${Math.round(speedKmh!)} km/t`;
      speedEl.style.display = "block";
    } else {
      speedEl.style.display = "none";
    }
  }
}
