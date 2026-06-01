import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export interface WeatherTimePoint {
  time: string; // ISO
  tempC: number;
  windMs: number;
  symbol?: string;
  precipMm?: number;
}

export interface WeatherForecast {
  fetchedAt: number;
  points: WeatherTimePoint[];
}

/**
 * Fetch a 9-day compact forecast from MET (Norwegian Meteorological Institute).
 * Runs server-side because browsers cannot set the required User-Agent header.
 */
export const fetchWeatherForecast = createServerFn({ method: "GET" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<WeatherForecast | null> => {
    const lat = Math.round(data.lat * 1000) / 1000;
    const lng = Math.round(data.lng * 1000) / 1000;
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Veiglede/1.0 github.com/thomastreffen/veiglede",
          Accept: "application/json",
        },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        properties?: {
          timeseries?: Array<{
            time: string;
            data?: {
              instant?: { details?: { air_temperature?: number; wind_speed?: number } };
              next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
              next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
            };
          }>;
        };
      };
      const series = json?.properties?.timeseries ?? [];
      const points: WeatherTimePoint[] = series.map((s) => {
        const inst = s.data?.instant?.details ?? {};
        const next1 = s.data?.next_1_hours;
        const next6 = s.data?.next_6_hours;
        return {
          time: s.time,
          tempC: typeof inst.air_temperature === "number" ? inst.air_temperature : NaN,
          windMs: typeof inst.wind_speed === "number" ? inst.wind_speed : NaN,
          symbol: next1?.summary?.symbol_code ?? next6?.summary?.symbol_code,
          precipMm:
            next1?.details?.precipitation_amount ??
            (next6?.details?.precipitation_amount != null
              ? next6.details.precipitation_amount / 6
              : undefined),
        };
      });
      return { fetchedAt: Date.now(), points };
    } catch {
      return null;
    }
  });
