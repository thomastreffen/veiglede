import { cn } from "@/lib/utils";

/**
 * Veiglede brand mark — single source of truth for the logo.
 *
 * The mark itself is currently a minimalist orange chevron (placeholder).
 * When the final brand asset arrives, swap the SVG in `<LogoGlyph />`
 * (or replace with an <img> import) and every surface below picks it
 * up automatically:
 *   - top navigation
 *   - login / signup / onboarding hero
 *   - shared trip header
 *   - roadbook header
 *   - favicon (see __root.tsx — uses the same chevron as a data URL)
 */

type Size = "sm" | "md" | "lg" | "xl";

const glyphSize: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

const wordmarkSize: Record<Size, string> = {
  sm: "text-sm tracking-[0.10em]",
  md: "text-lg tracking-[0.08em]",
  lg: "text-2xl tracking-[0.08em]",
  xl: "text-3xl tracking-[0.08em]",
};

export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <path
        d="M16 4 L29 28 L22 28 L16 16 L10 28 L3 28 Z"
        fill="oklch(0.78 0.17 65)"
      />
    </svg>
  );
}

interface Props {
  size?: Size;
  withWordmark?: boolean;
  className?: string;
}

export function VeigledeLogo({
  size = "md",
  withWordmark = true,
  className,
}: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoGlyph className={glyphSize[size]} />
      {withWordmark && (
        <span className={cn("font-display uppercase leading-none", wordmarkSize[size])}>
          VEIGLEDE
        </span>
      )}
    </span>
  );
}
