import { useDayWeather } from "@/lib/weather";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  lat?: number;
  lng?: number;
  date?: string;
  className?: string;
}

/**
 * Compact per-day weather row. Renders nothing when the date is outside
 * the MET forecast window or the request fails — degrades gracefully.
 */
export function DayWeather({ lat, lng, date, className }: Props) {
  const { loading, summary } = useDayWeather(lat, lng, date);

  if (loading) {
    return (
      <div className={className}>
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className={className}>
      <p className="text-xs text-foreground/80 flex items-center gap-1.5 flex-wrap">
        <span className="text-base leading-none">{summary.emoji}</span>
        <span className="font-medium tabular-nums">{summary.tempMin}–{summary.tempMax}°C</span>
        <span className="text-muted-foreground">·</span>
        <span className="tabular-nums">{summary.precipMm} mm</span>
        <span className="text-muted-foreground">·</span>
        <span className="tabular-nums">{summary.windMs} m/s</span>
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground/80">Værdata: Meteorologisk institutt</p>
    </div>
  );
}
