import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ---------- helpers ---------- */

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("Forbidden");
  if (data.is_active === false) throw new Error("Account deactivated");
  return true;
}

/* ---------- am-i-admin probe ---------- */

export const amIAdminFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role, is_active")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      isAdmin: data?.role === "admin" && data?.is_active !== false,
    };
  });

/* ---------- dashboard ---------- */

export const adminDashboardStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const now = Date.now();
    const day = 86_400_000;
    const sevenDaysAgo = new Date(now - 7 * day).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * day).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * day).toISOString();

    const [usersTotal, usersNew, allTrips, recentTrips, signups14d] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabaseAdmin.from("trips").select("data"),
      supabaseAdmin.from("trips").select("updated_at").gte("updated_at", thirtyDaysAgo),
      supabaseAdmin.from("profiles").select("created_at").gte("created_at", fourteenDaysAgo),
    ]);

    // Aggregate trips data
    let publicTrips = 0;
    let totalKm = 0;
    const regionCounts = new Map<string, number>();
    for (const row of allTrips.data ?? []) {
      const blob = (row as { data: unknown }).data as { trips?: Array<Record<string, unknown>> } | null;
      const trips = blob?.trips ?? [];
      for (const t of trips) {
        if (t.isPublic) publicTrips++;
        if (typeof t.distanceKm === "number") totalKm += t.distanceKm;
        const region = typeof t.region === "string" ? t.region : null;
        if (region) regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
      }
    }
    const topRegion = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    // Signup chart: bucket per day
    const buckets = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * day);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    for (const row of signups14d.data ?? []) {
      const created = (row as { created_at: string }).created_at;
      const key = created.slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const signups = [...buckets.entries()].map(([date, count]) => ({ date, count }));

    return {
      usersTotal: usersTotal.count ?? 0,
      usersNew7d: usersNew.count ?? 0,
      publicTrips,
      totalKm: Math.round(totalKm),
      activeTrips30d: recentTrips.data?.length ?? 0,
      topRegion,
      signups,
    };
  });

/* ---------- users ---------- */

export const adminListUsersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string } | undefined) =>
    z.object({ search: z.string().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    let q = supabaseAdmin
      .from("profiles")
      .select("id, display_name, username, avatar_url, role, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`display_name.ilike.${s},username.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) return { users: [] };

    // Trip counts (one query, group on client)
    const { data: tripsRows } = await supabaseAdmin
      .from("trips")
      .select("user_id, data")
      .in("user_id", ids);
    const tripCounts = new Map<string, number>();
    for (const row of tripsRows ?? []) {
      const blob = (row as { data: unknown }).data as { trips?: unknown[] } | null;
      tripCounts.set((row as { user_id: string }).user_id, blob?.trips?.length ?? 0);
    }

    // Emails via auth admin (best-effort)
    const emails = new Map<string, string>();
    try {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of list?.users ?? []) {
        if (u.email) emails.set(u.id, u.email);
      }
    } catch {
      // ignore
    }

    return {
      users: (rows ?? []).map((r) => ({
        ...r,
        email: emails.get(r.id) ?? null,
        tripCount: tripCounts.get(r.id) ?? 0,
      })),
    };
  });

export const adminSetUserRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "user" | "admin" }) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["user", "admin"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUserActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; isActive: boolean }) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- trips ---------- */

type AdminTrip = {
  id: string;
  title: string;
  origin: string;
  destination: string;
  distanceKm: number;
  createdAt: number;
  isPublic: boolean;
  ownerId: string;
  ownerUsername: string | null;
  ownerName: string | null;
  reactions: number;
};

export const adminListTripsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filter?: "all" | "hidden" | "public" } | undefined) =>
    z.object({ filter: z.enum(["all", "hidden", "public"]).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const filter = data.filter ?? "all";

    const { data: tripRows, error } = await supabaseAdmin
      .from("trips")
      .select("user_id, data");
    if (error) throw new Error(error.message);

    const tripIds: string[] = [];
    const flat: AdminTrip[] = [];
    const ownerIds = new Set<string>();
    for (const row of tripRows ?? []) {
      const userId = (row as { user_id: string }).user_id;
      const blob = (row as { data: unknown }).data as { trips?: Array<Record<string, unknown>> } | null;
      for (const t of blob?.trips ?? []) {
        const id = String(t.id ?? "");
        if (!id) continue;
        const isPublic = !!t.isPublic;
        if (filter === "public" && !isPublic) continue;
        if (filter === "hidden" && isPublic) continue;
        tripIds.push(id);
        ownerIds.add(userId);
        flat.push({
          id,
          title: String(t.title ?? ""),
          origin: String(t.origin ?? ""),
          destination: String(t.destination ?? ""),
          distanceKm: Number(t.distanceKm ?? 0),
          createdAt: Number(t.createdAt ?? 0),
          isPublic,
          ownerId: userId,
          ownerUsername: null,
          ownerName: null,
          reactions: 0,
        });
      }
    }

    // Owner names
    if (ownerIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, display_name")
        .in("id", [...ownerIds]);
      const m = new Map((profiles ?? []).map((p) => [p.id, p]));
      for (const t of flat) {
        const p = m.get(t.ownerId);
        t.ownerUsername = p?.username ?? null;
        t.ownerName = p?.display_name ?? null;
      }
    }

    // Reaction counts
    if (tripIds.length > 0) {
      const { data: reacts } = await supabaseAdmin
        .from("trip_reactions")
        .select("trip_id")
        .in("trip_id", tripIds);
      const counts = new Map<string, number>();
      for (const r of reacts ?? []) {
        const tid = (r as { trip_id: string }).trip_id;
        counts.set(tid, (counts.get(tid) ?? 0) + 1);
      }
      for (const t of flat) t.reactions = counts.get(t.id) ?? 0;
    }

    flat.sort((a, b) => b.createdAt - a.createdAt);
    return { trips: flat.slice(0, 500) };
  });

export const adminSetTripPublicFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ownerId: string; tripId: string; isPublic: boolean }) =>
    z.object({
      ownerId: z.string().uuid(),
      tripId: z.string().min(1).max(128),
      isPublic: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("trips").select("data").eq("user_id", data.ownerId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Trip blob not found");
    const blob = (row.data ?? {}) as { trips?: Array<Record<string, unknown>> };
    blob.trips = (blob.trips ?? []).map((t) =>
      t.id === data.tripId ? { ...t, isPublic: data.isPublic } : t,
    );
    const { error: upErr } = await supabaseAdmin
      .from("trips").update({ data: blob as never }).eq("user_id", data.ownerId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const adminDeleteTripFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ownerId: string; tripId: string }) =>
    z.object({
      ownerId: z.string().uuid(),
      tripId: z.string().min(1).max(128),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("trips").select("data").eq("user_id", data.ownerId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: true };
    const blob = (row.data ?? {}) as {
      trips?: Array<Record<string, unknown>>;
      days?: Array<Record<string, unknown>>;
      stops?: Array<Record<string, unknown>>;
    };
    const dayIds = new Set(
      (blob.days ?? []).filter((d) => d.tripId === data.tripId).map((d) => d.id as string),
    );
    blob.trips = (blob.trips ?? []).filter((t) => t.id !== data.tripId);
    blob.days = (blob.days ?? []).filter((d) => d.tripId !== data.tripId);
    blob.stops = (blob.stops ?? []).filter((s) => !dayIds.has(s.dayId as string));
    const { error: upErr } = await supabaseAdmin
      .from("trips").update({ data: blob as never }).eq("user_id", data.ownerId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/* ---------- partners ---------- */

const partnerSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(["mat", "overnatting", "attraksjon", "drivstoff"]),
  logo_url: z.string().url().max(1000).nullable().optional(),
  website: z.string().url().max(1000).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  region: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const adminListPartnersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("partners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { partners: data ?? [] };
  });

export const adminCreatePartnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => partnerSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("partners").insert(data).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return { partner: row };
  });

export const adminUpdatePartnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).merge(partnerSchema.partial()).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("partners").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePartnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("partners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
