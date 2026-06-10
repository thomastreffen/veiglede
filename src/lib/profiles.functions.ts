import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const USERNAME_RE = /^[a-z0-9]([a-z0-9-]{1,18}[a-z0-9])?$/;

const UsernameSchema = z.object({
  username: z.string().min(3).max(20).regex(USERNAME_RE),
});

export interface PublicProfileVehicle {
  id: string;
  name: string;
  nickname?: string;
  description?: string;
  type: string;
  energy: string;
  defaultStyle: string;
  photo?: string;
  photos: { id: string; url: string; caption?: string | null }[];
}

export interface PublicProfileTrip {
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
  createdAt: number;
}

export interface PublicProfilePayload {
  found: boolean;
  isPrivate?: boolean;
  profile?: {
    id: string;
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
  };
  toggles?: {
    showGarage: boolean;
    showTrips: boolean;
    showStats: boolean;
  };
  stats?: { tripsCount: number; totalKm: number; drivenKm: number };
  vehicles?: PublicProfileVehicle[];
  trips?: PublicProfileTrip[];
}

/** Look up a public profile (and their vehicles + public trips) by username. */
export const getPublicProfileByUsername = createServerFn({ method: "GET" })
  .inputValidator((data) => UsernameSchema.parse(data))
  .handler(async ({ data }): Promise<PublicProfilePayload> => {
    const username = data.username.toLowerCase();

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, is_public, show_garage, show_trips, show_stats")
      .eq("username", username)
      .maybeSingle();

    if (pErr || !profile) return { found: false };
    if (profile.is_public !== true) {
      return {
        found: true,
        isPrivate: true,
        profile: {
          id: profile.id as string,
          username,
          displayName: (profile.display_name as string | null) ?? username,
          avatarUrl: (profile.avatar_url as string | null) ?? undefined,
        },
      };
    }
    const userId = profile.id as string;
    const showGarage = profile.show_garage !== false;
    const showTrips = profile.show_trips !== false;
    const showStats = profile.show_stats !== false;

    const [{ data: vehRow }, { data: tripsRow }, { data: photoRows }] = await Promise.all([
      supabaseAdmin.from("vehicles").select("data").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("trips").select("data").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("vehicle_photos")
        .select("id, vehicle_id, url, caption, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const photosByVehicle = new Map<string, { id: string; url: string; caption?: string | null }[]>();
    for (const ph of photoRows ?? []) {
      const arr = photosByVehicle.get(ph.vehicle_id as string) ?? [];
      arr.push({ id: ph.id as string, url: ph.url as string, caption: ph.caption as string | null });
      photosByVehicle.set(ph.vehicle_id as string, arr);
    }

    const vBlob = (vehRow?.data ?? null) as { vehicles?: Record<string, unknown>[] } | null;
    const allVehicles = (vBlob?.vehicles ?? []).filter((v) => v.isPublic !== false);
    const vehicles: PublicProfileVehicle[] = (showGarage ? allVehicles : []).map((v) => ({
      id: String(v.id ?? ""),
      name: String(v.name ?? "Kjøretøy"),
      type: String(v.type ?? "car"),
      energy: String(v.energy ?? "petrol"),
      defaultStyle: String(v.defaultStyle ?? "scenic"),
      photo: typeof v.photo === "string" ? v.photo : undefined,
      photos: photosByVehicle.get(String(v.id ?? "")) ?? [],
    }));

    const tBlob = (tripsRow?.data ?? null) as { trips?: Record<string, unknown>[] } | null;
    const allTrips = tBlob?.trips ?? [];
    const publicTrips: PublicProfileTrip[] = [];
    let tripsCount = 0;
    let totalKm = 0;
    let drivenKm = 0;
    for (const t of allTrips) {
      if (t?.status === "draft") continue;
      tripsCount += 1;
      totalKm += Number(t.distanceKm ?? 0);
      const actual = Number(t.actualDistanceKm ?? 0);
      if (actual > 0) drivenKm += actual;
      if (showTrips && t.isPublic === true && typeof t.shareToken === "string") {
        publicTrips.push({
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
          startDate: typeof t.startDate === "string" ? t.startDate : undefined,
          shareToken: t.shareToken,
          createdAt: Number(t.createdAt ?? 0),
        });
      }
    }
    publicTrips.sort((a, b) => b.createdAt - a.createdAt);

    return {
      found: true,
      profile: {
        id: userId,
        username,
        displayName: (profile.display_name as string | null) ?? username,
        bio: (profile.bio as string | null) ?? undefined,
        avatarUrl: (profile.avatar_url as string | null) ?? undefined,
      },
      toggles: { showGarage, showTrips, showStats },
      stats: showStats ? { tripsCount, totalKm: Math.round(totalKm), drivenKm: Math.round(drivenKm) } : undefined,
      vehicles,
      trips: publicTrips,
    };
  });
