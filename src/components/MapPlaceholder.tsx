import { cn } from "@/lib/utils";

interface Props { className?: string; labels?: string[]; height?: string; distance?: string; time?: string }

export function MapPlaceholder({ className, labels = [], height = "h-56", distance, time }: Props) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-surface", height, className)}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <defs>
          <pattern id="vg-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="oklch(0.28 0.014 250)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="vg-bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.22 0.015 250)" />
            <stop offset="100%" stopColor="oklch(0.16 0.012 250)" />
          </linearGradient>
          <linearGradient id="vg-route" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.85 0.16 85)" />
            <stop offset="100%" stopColor="oklch(0.72 0.18 55)" />
          </linearGradient>
          <radialGradient id="vg-glow" cx="80%" cy="20%" r="50%">
            <stop offset="0%" stopColor="oklch(0.78 0.17 65 / 0.25)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="400" height="200" fill="url(#vg-bg)" />
        <rect width="400" height="200" fill="url(#vg-grid)" />
        <rect width="400" height="200" fill="url(#vg-glow)" />
        {/* terrain hints */}
        <path d="M0,150 C70,130 130,170 200,140 C270,115 330,160 400,135 L400,200 L0,200 Z" fill="oklch(0.24 0.018 250 / 0.6)" />
        <path d="M0,170 C90,155 170,185 260,165 C320,150 370,175 400,165 L400,200 L0,200 Z" fill="oklch(0.20 0.016 250 / 0.6)" />
        {/* route */}
        <path d="M30,170 C100,150 110,70 200,90 C290,110 310,30 370,40" fill="none" stroke="url(#vg-route)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M30,170 C100,150 110,70 200,90 C290,110 310,30 370,40" fill="none" stroke="oklch(0.78 0.17 65)" strokeWidth="8" strokeLinecap="round" opacity="0.15" />
        <circle cx="30" cy="170" r="6" fill="oklch(0.78 0.17 65)" />
        <circle cx="30" cy="170" r="11" fill="none" stroke="oklch(0.78 0.17 65 / 0.35)" strokeWidth="2" />
        <circle cx="370" cy="40" r="6" fill="oklch(0.85 0.16 85)" />
        <circle cx="370" cy="40" r="11" fill="none" stroke="oklch(0.85 0.16 85 / 0.35)" strokeWidth="2" />
      </svg>
      {labels.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="font-medium text-foreground/80">{labels[0]}</span>
          {(distance || time) && (
            <span className="rounded-full bg-background/70 backdrop-blur px-2.5 py-1 text-[10px] text-foreground/80 border border-border">
              {distance}{distance && time ? " · " : ""}{time}
            </span>
          )}
          <span className="font-medium text-foreground/80">{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
