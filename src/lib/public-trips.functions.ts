import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TokenSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

export interface PublicTripPayload {
  found: boolean;
  isPrivate?: boolean;
  trip?: Json;
  days?: Json[];
  stops?: Json[];
}

/**
 * Look up a trip by its public share token across all users' jsonb trip blobs.
 * Returns `{ isPrivate: true }` if the token matches a trip whose owner has
 * disabled public sharing, and `{ found: false }` if the token is unknown.
 *
 * Uses supabaseAdmin to scan rows because trips are stored as a single jsonb
 * blob per user; bypassing RLS is required to read another user's blob, and
 * we filter to public trips before returning anything.
 */
export const getPublicTripByToken = createServerFn({ method: "GET" })
  .inputValidator((data) => TokenSchema.parse(data))
  .handler(async ({ data }): Promise<PublicTripPayload> => {
    const { token } = data;

    const { data: rows, error } = await supabaseAdmin
      .from("trips")
      .select("data")
      .filter("data->trips", "cs", JSON.stringify([{ shareToken: token }]));

    if (error || !rows || rows.length === 0) {
      return { found: false };
    }

    for (const row of rows) {
      const blob = row.data as {
        trips?: Json[];
        days?: Json[];
        stops?: Json[];
      } | null;
      if (!blob?.trips) continue;
      const match = blob.trips.find(
        (t): t is { [key: string]: Json | undefined } =>
          typeof t === "object" && t !== null && !Array.isArray(t) && (t as Record<string, Json | undefined>)["shareToken"] === token,
      );
      if (!match) continue;
      if (match["isPublic"] !== true) {
        return { found: true, isPrivate: true };
      }
      const tripId = match["id"] as string | undefined;
      const days = (blob.days ?? []).filter(
        (d): d is { [key: string]: Json | undefined } =>
          typeof d === "object" && d !== null && !Array.isArray(d) && (d as Record<string, Json | undefined>)["tripId"] === tripId,
      );
      const dayIds = new Set(days.map((d) => d["id"] as string | undefined));
      const stops = (blob.stops ?? []).filter(
        (s): s is { [key: string]: Json | undefined } =>
          typeof s === "object" && s !== null && !Array.isArray(s) && dayIds.has((s as Record<string, Json | undefined>)["dayId"] as string | undefined),
      );
      return { found: true, trip: match, days, stops };
    }

    return { found: false };
  });
