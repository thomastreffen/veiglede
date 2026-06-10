import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publicPlaceName } from "@/lib/public-place";
import { signAvatarServer } from "@/lib/avatar.server";

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
  /** Owner info for attribution + linking to public profile. */
  owner?: {
    displayName: string;
    username?: string;
    avatarUrl?: string;
    isPublicProfile: boolean;
  };
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

    console.log("Share token lookup:", token, "rows:", rows?.length ?? 0, "error:", error?.message);

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
        console.log("Share token lookup:", token, "result: private");
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
      console.log("Share token lookup:", token, "result:", tripId, "days:", days.length, "stops:", stops.length);
      // Strip full street address before returning publicly.
      const safeTrip: { [key: string]: Json | undefined } = {
        ...match,
        origin: publicPlaceName(match["origin"] as string | undefined),
        destination: publicPlaceName(match["destination"] as string | undefined),
        originLoc: undefined,
        destinationLoc: undefined,
      };
      return { found: true, trip: safeTrip, days, stops };
    }

    return { found: false };
  });

/** Safe, public-facing summary of a trip for the /explore feed. */
export interface PublicTripSummary {
  id: string;
  title: string;
  subtitle?: string;
  region?: string;
  origin: string;
  destination: string;
  distanceKm: number;
  drivingTime: string;
  stopsCount: number;
  cover: string;
  style: string;
  vehicle: string;
  startDate?: string;
  shareToken: string;
  ownerName?: string;
  ownerAvatarUrl?: string;
  createdAt: number;
}

/**
 * Fetch up to 20 publicly-shared trips across all users, newest first.
 * Only trips with isPublic === true AND a shareToken are returned.
 * Returns only safe fields — no emails, no private notes, no precise coords.
 */
export const fetchPublicTripsFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<PublicTripSummary[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("trips")
      .select("user_id, data, updated_at");

    if (error || !rows) {
      console.error("fetchPublicTrips error:", error?.message);
      return [];
    }

    // Collect public trips from every user's jsonb blob.
    const collected: Array<PublicTripSummary & { _userId: string }> = [];
    for (const row of rows) {
      const blob = row.data as { trips?: Array<Record<string, unknown>> } | null;
      if (!blob?.trips) continue;
      for (const t of blob.trips) {
        if (t?.isPublic !== true) continue;
        if (t?.status === "draft") continue; // never show drafts publicly
        const shareToken = typeof t.shareToken === "string" ? t.shareToken : undefined;
        if (!shareToken) continue;
        collected.push({
          _userId: row.user_id as string,
          id: String(t.id ?? ""),
          title: String(t.title ?? "Tur"),
          subtitle: typeof t.subtitle === "string" ? t.subtitle : undefined,
          region: typeof t.region === "string" ? t.region : undefined,
          origin: publicPlaceName(String(t.origin ?? "")),
          destination: publicPlaceName(String(t.destination ?? "")),
          distanceKm: Number(t.distanceKm ?? 0),
          drivingTime: String(t.drivingTime ?? ""),
          stopsCount: Number(t.stopsCount ?? 0),
          cover: String(t.cover ?? "fjord"),
          style: String(t.style ?? "scenic"),
          vehicle: String(t.vehicle ?? "car"),
          startDate: typeof t.startDate === "string" ? t.startDate : undefined,
          shareToken,
          createdAt: Number(t.createdAt ?? 0),
        });
      }
    }

    if (collected.length === 0) return [];

    // Look up display names for the involved users (one query).
    const userIds = Array.from(new Set(collected.map((c) => c._userId)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);
    const nameById = new Map<string, { name?: string; avatar?: string }>();
    for (const p of profiles ?? []) {
      const avatar = (await signAvatarServer((p.avatar_url as string | null) ?? undefined)) ?? undefined;
      nameById.set(p.id as string, {
        name: (p.display_name as string | null) ?? undefined,
        avatar,
      });
    }

    return collected
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map(({ _userId, ...summary }) => ({
        ...summary,
        ownerName: nameById.get(_userId)?.name,
        ownerAvatarUrl: nameById.get(_userId)?.avatar,
      }));
  });
