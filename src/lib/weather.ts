import { useEffect, useState } from "react";
import { fetchWeatherForecast, type WeatherForecast } from "@/lib/weather.functions";
import { lookupPlace, type LatLng } from "@/lib/geo";
import type { Trip, TripDay, Stop } from "@/lib/trips-store";

/** Compute the ISO date (YYYY-MM-DD) for a given trip day, falling back to trip.startDate + offset. */
export function dayDate(trip: Trip, day: TripDay): string | undefined {
  if (day.date) return day.date.slice(0, 10);
  if (!trip.startDate) return undefined;
  const base = new Date(trip.startDate);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setDate(base.getDate() + (day.dayNumber - 1));
  return base.toISOString().slice(0, 10);
}

/** Pick coords for a day: first stop with lat/lng, else trip.originLoc, else geocoded origin. */
export function dayCoords(trip: Trip, dayStops: Stop[]): LatLng | undefined {
  const stopHit = dayStops.find((s) => s.lat != null && s.lng != null);
  if (stopHit) return { lat: stopHit.lat!, lng: stopHit.lng! };
  if (trip.originLoc) return trip.originLoc;
  return lookupPlace(trip.origin);
}

/** Map MET symbol_code → emoji. Handles `_day`/`_night`/`_polartwilight` suffixes. */
export function symbolToEmoji(symbol?: string): string {
  if (!symbol) return "🌡️";
  const base = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (base.includes("thunder")) return "⛈️";
  if (base.includes("snow") || base.includes("sleet")) return "❄️";
  if (base.includes("rain") || base.includes("showers") || base.includes("drizzle")) return "🌧️";
  if (base.includes("fog")) return "🌫️";
  if (base === "clearsky" || base === "fair") return "☀️";
  if (base.includes("partlycloudy")) return "⛅";
  if (base.includes("cloudy")) return "☁️";
  return "🌡️";
}

export interface DayWeatherSummary {
  emoji: string;
  symbol?: string;
  tempMin: number;
  tempMax: number;
  precipMm: number;
  windMs: number;
}

/** Summarise a single day (YYYY-MM-DD) from a forecast. Returns null if no data covers that date. */
export function summariseDay(forecast: WeatherForecast | null, dateIso: string): DayWeatherSummary | null {
  if (!forecast) return null;
  const pts = forecast.points.filter((p) => p.time.slice(0, 10) === dateIso);
  if (pts.length === 0) return null;
  const temps = pts.map((p) => p.tempC).filter((n) => Number.isFinite(n));
  if (temps.length === 0) return null;
  const winds = pts.map((p) => p.windMs).filter((n) => Number.isFinite(n));
  const precip = pts.reduce((sum, p) => sum + (p.precipMm ?? 0), 0);
  // Pick the symbol closest to local noon
  const midday = pts.reduce((best, p) => {
    const hour = new Date(p.time).getUTCHours();
    const score = Math.abs(hour - 12);
    if (!best || score < best.score) return { score, symbol: p.symbol };
    return best;
  }, null as null | { score: number; symbol?: string });
  return {
    emoji: symbolToEmoji(midday?.symbol),
    symbol: midday?.symbol,
    tempMin: Math.round(Math.min(...temps)),
    tempMax: Math.round(Math.max(...temps)),
    precipMm: Math.round(precip * 10) / 10,
    windMs: winds.length ? Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10 : 0,
  };
}

/** True if the date is within MET's ~9-day forecast window. */
export function isWithinForecastWindow(dateIso?: string): boolean {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000);
  return diffDays >= -1 && diffDays <= 9;
}

/** In-memory cache keyed by rounded lat/lng. Forecasts expire after 30 min. */
const cache = new Map<string, { at: number; promise: Promise<WeatherForecast | null> }>();
const TTL_MS = 30 * 60 * 1000;

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export function loadForecast(lat: number, lng: number): Promise<WeatherForecast | null> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetchWeatherForecast({ data: { lat, lng } }).catch(() => null);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** React hook: fetch + summarise weather for a (lat,lng,date). */
export function useDayWeather(
  lat: number | undefined,
  lng: number | undefined,
  dateIso: string | undefined,
): { loading: boolean; summary: DayWeatherSummary | null } {
  const [state, setState] = useState<{ loading: boolean; summary: DayWeatherSummary | null }>(
    { loading: false, summary: null },
  );

  useEffect(() => {
    if (lat == null || lng == null || !dateIso || !isWithinForecastWindow(dateIso)) {
      setState({ loading: false, summary: null });
      return;
    }
    let cancelled = false;
    setState({ loading: true, summary: null });
    loadForecast(lat, lng).then((fc) => {
      if (cancelled) return;
      setState({ loading: false, summary: summariseDay(fc, dateIso) });
    });
    return () => { cancelled = true; };
  }, [lat, lng, dateIso]);

  return state;
}
