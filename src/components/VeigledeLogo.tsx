import { cn } from "@/lib/utils";

/**
 * Veiglede brand mark — single source of truth for the logo.
 *
 * Glyph: a winding Scandinavian road with a warm-orange center stripe
 * and a destination pin marker. Wordmark splits "VEI" (neutral/foreground)
 * from "GLEDE" (primary orange) — the same idea repeats on the favicon
 * (see __root.tsx data-URL SVG).
 */

type Size = "sm" | "md" | "lg" | "xl";
type Tone = "auto" | "light" | "dark";

const glyphSize: Record<Size, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

const wordmarkSize: Record<Size, string> = {
  sm: "text-base tracking-[0.06em]",
  md: "text-xl tracking-[0.05em]",
  lg: "text-3xl tracking-[0.05em]",
  xl: "text-5xl tracking-[0.04em]",
};

const taglineSize: Record<Size, string> = {
  sm: "text-[8px] tracking-[0.20em]",
  md: "text-[9px] tracking-[0.22em]",
  lg: "text-[11px] tracking-[0.24em]",
  xl: "text-xs tracking-[0.26em]",
};

export function LogoGlyph({ className }: { className?: string }) {
  // Winding road + destination pin. Uses currentColor for the road body
  // so it reads correctly on both light and dark backgrounds; the orange
  // road stripe + pin are anchored to the brand primary.
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      role="presentation"
      fill="none"
    >
      {/* Road body */}
      <path
        d="M14 44 C 14 34, 26 32, 26 22 C 26 14, 16 12, 16 6"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* Orange center stripe */}
      <path
        d="M14 44 C 14 34, 26 32, 26 22 C 26 14, 16 12, 16 6"
        stroke="oklch(0.78 0.17 65)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      {/* Destination pin */}
      <g transform="translate(28 4)">
        <path
          d="M6 0 C 9.3 0, 12 2.7, 12 6 C 12 10, 6 16, 6 16 C 6 16, 0 10, 0 6 C 0 2.7, 2.7 0, 6 0 Z"
          fill="oklch(0.78 0.17 65)"
        />
        <circle cx="6" cy="6" r="2.2" fill="white" />
      </g>
    </svg>
  );
}

interface Props {
  size?: Size;
  withWordmark?: boolean;
  withTagline?: boolean;
  tone?: Tone;
  className?: string;
}

export function VeigledeLogo({
  size = "md",
  withWordmark = true,
  withTagline = false,
  tone = "auto",
  className,
}: Props) {
  // `tone` lets callers force a color (useful when the logo sits on a
  // photo/dark hero regardless of the active theme).
  const toneClass =
    tone === "light"
      ? "text-white"
      : tone === "dark"
        ? "text-slate-900"
        : "text-foreground";

  return (
    <span className={cn("inline-flex items-center gap-2.5", toneClass, className)}>
      <LogoGlyph className={glyphSize[size]} />
      {withWordmark && (
        <span className="inline-flex flex-col leading-none">
          <span className={cn("font-display uppercase", wordmarkSize[size])}>
            <span>VEI</span>
            <span className="text-primary">GLEDE</span>
          </span>
          {withTagline && (
            <span
              className={cn(
                "mt-1 uppercase opacity-70",
                taglineSize[size],
              )}
            >
              Den gode veien, ikke bare den raske
            </span>
          )}
        </span>
      )}
    </span>
  );
}
