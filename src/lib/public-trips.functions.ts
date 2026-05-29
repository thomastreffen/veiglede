import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TokenSchema = z.object({
  token: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

export interface PublicTripPayload {
  found: boolean;
  isPrivate?: boolean;
  trip?: unknown;
  days?: unknown[];
  stops?: unknown[];
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
        trips?: Array<Record<string, unknown>>;
        days?: Array<Record<string, unknown>>;
        stops?: Array<Record<string, unknown>>;
      } | null;
      if (!blob?.trips) continue;
      const match = blob.trips.find((t) => t["shareToken"] === token);
      if (!match) continue;
      if (match["isPublic"] !== true) {
        return { found: true, isPrivate: true };
      }
      const tripId = match["id"] as string | undefined;
      const days = (blob.days ?? []).filter((d) => d["tripId"] === tripId);
      const dayIds = new Set(days.map((d) => d["id"]));
      const stops = (blob.stops ?? []).filter((s) => dayIds.has(s["dayId"]));
      return { found: true, trip: match, days, stops };
    }

    return { found: false };
  });
