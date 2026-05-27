import { cn } from "@/lib/utils";

interface Props { className?: string; labels?: string[]; height?: string }

export function MapPlaceholder({ className, labels = [], height = "h-56" }: Props) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-secondary", height, className)}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="oklch(0.88 0.018 80)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="terrain" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.94 0.015 80)" />
            <stop offset="100%" stopColor="oklch(0.86 0.03 75)" />
          </linearGradient>
        </defs>
        <rect width="400" height="200" fill="url(#terrain)" />
        <rect width="400" height="200" fill="url(#grid)" />
        {/* organic shapes */}
        <path d="M0,140 C80,110 140,170 220,130 C290,95 340,150 400,120 L400,200 L0,200 Z" fill="oklch(0.78 0.04 130 / 0.35)" />
        <path d="M0,80 C90,60 160,100 240,70 C320,45 360,75 400,55 L400,90 C320,110 260,80 180,110 C100,140 60,110 0,130 Z" fill="oklch(0.7 0.05 200 / 0.18)" />
        {/* route */}
        <path
          d="M30,170 C100,150 130,80 200,90 C270,100 300,40 370,30"
          fill="none"
          stroke="oklch(0.48 0.04 60)"
          strokeWidth="2.5"
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        <circle cx="30" cy="170" r="5" fill="oklch(0.48 0.04 60)" />
        <circle cx="370" cy="30" r="5" fill="oklch(0.48 0.04 60)" />
      </svg>
      {labels.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
