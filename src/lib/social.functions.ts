import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signAvatarServer } from "@/lib/avatar.server";

const ReactionEnum = z.enum(["fire", "clap", "pin"]);
export type ReactionKey = z.infer<typeof ReactionEnum>;

const UuidSchema = z.string().uuid();

/* ============ FOLLOWS ============ */

export const toggleFollowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ followingId: UuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.followingId) throw new Error("Kan ikke følge deg selv");

    const { data: existing } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", userId)
      .eq("following_id", data.followingId)
      .maybeSingle();

    if (existing) {
      await supabase.from("user_follows").delete()
        .eq("follower_id", userId).eq("following_id", data.followingId);
      return { following: false };
    }
    await supabase.from("user_follows").insert({ follower_id: userId, following_id: data.followingId });
    return { following: true };
  });

export interface FollowStats {
  followers: number;
  following: number;
  isFollowing: boolean;
}

export const getFollowStatsFn = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ userId: UuidSchema, viewerId: UuidSchema.optional() }).parse(input))
  .handler(async ({ data }): Promise<FollowStats> => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabaseAdmin.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", data.userId),
      supabaseAdmin.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", data.userId),
    ]);
    let isFollowing = false;
    if (data.viewerId && data.viewerId !== data.userId) {
      const { data: row } = await supabaseAdmin.from("user_follows")
        .select("follower_id").eq("follower_id", data.viewerId).eq("following_id", data.userId).maybeSingle();
      isFollowing = !!row;
    }
    return { followers: followers ?? 0, following: following ?? 0, isFollowing };
  });

/* ============ REACTIONS ============ */

const TripIdSchema = z.string().min(1).max(128);

export const toggleReactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: TripIdSchema, reaction: ReactionEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("trip_reactions").select("id")
      .eq("trip_id", data.tripId).eq("user_id", userId).eq("reaction", data.reaction)
      .maybeSingle();
    if (existing) {
      await supabase.from("trip_reactions").delete().eq("id", existing.id);
      return { active: false };
    }
    await supabase.from("trip_reactions").insert({ trip_id: data.tripId, user_id: userId, reaction: data.reaction });
    return { active: true };
  });

export interface TripReactionCounts {
  fire: number;
  clap: number;
  pin: number;
  mine: ReactionKey[];
}

export const getTripReactionsFn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    tripIds: z.array(TripIdSchema).min(1).max(100),
    viewerId: UuidSchema.optional(),
  }).parse(input))
  .handler(async ({ data }): Promise<Record<string, TripReactionCounts>> => {
    const { data: rows } = await supabaseAdmin
      .from("trip_reactions").select("trip_id, reaction, user_id")
      .in("trip_id", data.tripIds);
    const out: Record<string, TripReactionCounts> = {};
    for (const id of data.tripIds) out[id] = { fire: 0, clap: 0, pin: 0, mine: [] };
    for (const r of rows ?? []) {
      const tid = r.trip_id as string;
      const k = r.reaction as ReactionKey;
      if (!out[tid]) continue;
      out[tid][k] += 1;
      if (data.viewerId && r.user_id === data.viewerId) out[tid].mine.push(k);
    }
    return out;
  });

/* ============ SAVED TRIPS ============ */

export const toggleSaveTripFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sourceTripId: TripIdSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_trips").select("id")
      .eq("user_id", userId).eq("source_trip_id", data.sourceTripId)
      .maybeSingle();
    if (existing) {
      await supabase.from("saved_trips").delete().eq("id", existing.id);
      return { saved: false };
    }
    await supabase.from("saved_trips").insert({ user_id: userId, source_trip_id: data.sourceTripId });
    return { saved: true };
  });

export const listSavedTripIdsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("saved_trips").select("source_trip_id").eq("user_id", userId);
    return (rows ?? []).map((r) => r.source_trip_id as string);
  });

/* ============ FEED FROM FOLLOWS ============ */

export interface FeedTrip {
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
  shareToken: string;
  createdAt: number;
  ownerName?: string;
  ownerAvatarUrl?: string;
}

export const feedFromFollowsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedTrip[]> => {
    const { supabase, userId } = context;
    const { data: follows } = await supabase.from("user_follows")
      .select("following_id").eq("follower_id", userId);
    const ids = (follows ?? []).map((f) => f.following_id as string);
    if (ids.length === 0) return [];

    const { data: rows } = await supabaseAdmin
      .from("trips").select("user_id, data").in("user_id", ids);
    const collected: Array<FeedTrip & { _userId: string }> = [];
    for (const row of rows ?? []) {
      const blob = row.data as { trips?: Array<Record<string, unknown>> } | null;
      for (const t of blob?.trips ?? []) {
        if (t?.isPublic !== true) continue;
        const shareToken = typeof t.shareToken === "string" ? t.shareToken : undefined;
        if (!shareToken) continue;
        collected.push({
          _userId: row.user_id as string,
          id: String(t.id ?? ""),
          title: String(t.title ?? "Tur"),
          subtitle: typeof t.subtitle === "string" ? t.subtitle : undefined,
          region: typeof t.region === "string" ? t.region : undefined,
          origin: String(t.origin ?? ""),
          destination: String(t.destination ?? ""),
          distanceKm: Number(t.distanceKm ?? 0),
          drivingTime: String(t.drivingTime ?? ""),
          stopsCount: Number(t.stopsCount ?? 0),
          cover: String(t.cover ?? "fjord"),
          style: String(t.style ?? "scenic"),
          vehicle: String(t.vehicle ?? "car"),
          shareToken,
          createdAt: Number(t.createdAt ?? 0),
        });
      }
    }
    if (collected.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name, avatar_url").in("id", ids);
    const byId = new Map<string, { name?: string; avatar?: string }>();
    for (const p of profiles ?? []) {
      byId.set(p.id as string, {
        name: (p.display_name as string | null) ?? undefined,
        avatar: (p.avatar_url as string | null) ?? undefined,
      });
    }
    return collected
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
      .map(({ _userId, ...t }) => ({
        ...t,
        ownerName: byId.get(_userId)?.name,
        ownerAvatarUrl: byId.get(_userId)?.avatar,
      }));
  });
