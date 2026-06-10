import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signAvatarServer } from "@/lib/avatar.server";

export interface PublicProfileSummary {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  tripsCount: number;
  totalKm: number;
  vehicleTypes: string[]; // unique vehicle types this user owns, e.g. ["car","motorcycle"]
}

/**
 * Fetch public user profiles for the /explore "Brukere" tab.
 * Aggregates trip counts and vehicle types from the per-user jsonb blobs.
 * Sorted by trip count (desc), newest first as tiebreaker.
 */
export const fetchPublicProfilesFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<PublicProfileSummary[]> => {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, is_public, created_at")
      .eq("is_public", true)
      .not("username", "is", null);

    if (error || !profiles) {
      console.error("fetchPublicProfiles error:", error?.message);
      return [];
    }
    if (profiles.length === 0) return [];

    const userIds = profiles.map((p) => p.id as string);

    const [{ data: tripsRows }, { data: vehRows }] = await Promise.all([
      supabaseAdmin.from("trips").select("id, data").in("id", userIds),
      supabaseAdmin.from("vehicles").select("id, data").in("id", userIds),
    ]);

    const tripStatsById = new Map<string, { count: number; km: number }>();
    for (const row of tripsRows ?? []) {
      const blob = row.data as { trips?: Array<Record<string, unknown>> } | null;
      let count = 0;
      let km = 0;
      for (const t of blob?.trips ?? []) {
        if (t?.status === "draft") continue;
        count += 1;
        km += Number(t.distanceKm ?? 0);
      }
      tripStatsById.set(row.id as string, { count, km });
    }

    const vehicleTypesById = new Map<string, string[]>();
    for (const row of vehRows ?? []) {
      const blob = row.data as { vehicles?: Array<Record<string, unknown>> } | null;
      const types = new Set<string>();
      for (const v of blob?.vehicles ?? []) {
        if (typeof v.type === "string") types.add(v.type);
      }
      vehicleTypesById.set(row.id as string, Array.from(types));
    }

    const summaries: PublicProfileSummary[] = await Promise.all(profiles.map(async (p) => {
      const id = p.id as string;
      const stats = tripStatsById.get(id) ?? { count: 0, km: 0 };
      const avatarUrl = (await signAvatarServer((p.avatar_url as string | null) ?? undefined)) ?? undefined;
      return {
        id,
        username: p.username as string,
        displayName: (p.display_name as string | null) ?? (p.username as string),
        bio: (p.bio as string | null) ?? undefined,
        avatarUrl,
        tripsCount: stats.count,
        totalKm: Math.round(stats.km),
        vehicleTypes: vehicleTypesById.get(id) ?? [],
      };
    }));

    summaries.sort((a, b) => {
      if (b.tripsCount !== a.tripsCount) return b.tripsCount - a.tripsCount;
      return b.totalKm - a.totalKm;
    });

    return summaries;
  });

/** Count of public user profiles (for the landing-page hero counter). */
export const countPublicProfilesFn = createServerFn({ method: "GET" })
  .handler(async (): Promise<number> => {
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_public", true)
      .not("username", "is", null);
    if (error) {
      console.error("countPublicProfiles error:", error.message);
      return 0;
    }
    return count ?? 0;
  });
