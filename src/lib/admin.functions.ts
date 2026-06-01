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

    // Subscriptions (plan per user)
    const plans = new Map<string, { plan: string; period_end: string | null; status: string }>();
    {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan, current_period_end, status")
        .in("user_id", ids);
      for (const s of subs ?? []) {
        plans.set(s.user_id as string, {
          plan: (s.plan as string) ?? "free",
          period_end: (s.current_period_end as string | null) ?? null,
          status: (s.status as string) ?? "active",
        });
      }
    }

    // Last active = most recent updated_at on trips row
    const lastActive = new Map<string, string>();
    {
      const { data: rows } = await supabaseAdmin
        .from("trips")
        .select("user_id, updated_at")
        .in("user_id", ids);
      for (const r of rows ?? []) {
        const uid = r.user_id as string;
        const ts = r.updated_at as string;
        const prev = lastActive.get(uid);
        if (!prev || ts > prev) lastActive.set(uid, ts);
      }
    }

    return {
      users: (rows ?? []).map((r) => ({
        ...r,
        email: emails.get(r.id) ?? null,
        tripCount: tripCounts.get(r.id) ?? 0,
        plan: plans.get(r.id)?.plan ?? "free",
        plan_period_end: plans.get(r.id)?.period_end ?? null,
        last_active: lastActive.get(r.id) ?? null,
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

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: data.role === "admin" ? "add_admin" : "remove_admin",
      target_user_id: data.userId,
      metadata: { role: data.role },
    });
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

    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: context.userId,
      action: data.isActive ? "activate" : "deactivate",
      target_user_id: data.userId,
    });
    return { ok: true };
  });

/* ---------- user details + audit log ---------- */

export const adminGetUserDetailsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const uid = data.userId;

    const [{ data: profile }, { data: sub }, { data: tripsRow }, { data: vehRow }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("subscriptions").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("trips").select("data, updated_at").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("vehicles").select("data").eq("id", uid).maybeSingle(),
    ]);

    let email: string | null = null;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      email = u?.user?.email ?? null;
    } catch { /* ignore */ }

    const tBlob = (tripsRow?.data ?? null) as { trips?: Array<Record<string, unknown>> } | null;
    const allTrips = tBlob?.trips ?? [];
    let totalKm = 0;
    let drivenKm = 0;
    for (const t of allTrips) {
      totalKm += Number(t.distanceKm ?? 0);
      drivenKm += Number(t.actualDistanceKm ?? 0);
    }

    const vBlob = (vehRow?.data ?? null) as { vehicles?: Array<Record<string, unknown>> } | null;
    const vehicles = (vBlob?.vehicles ?? []).map((v) => ({
      id: String(v.id ?? ""),
      name: String(v.name ?? "Kjøretøy"),
      type: String(v.type ?? "car"),
      energy: String(v.energy ?? "petrol"),
    }));

    return {
      profile: profile
        ? {
            id: profile.id as string,
            display_name: (profile.display_name as string | null) ?? null,
            username: (profile.username as string | null) ?? null,
            avatar_url: (profile.avatar_url as string | null) ?? null,
            bio: (profile.bio as string | null) ?? null,
            role: (profile.role as string | null) ?? "user",
            is_active: profile.is_active !== false,
            created_at: profile.created_at as string,
          }
        : null,
      email,
      subscription: sub
        ? {
            plan: sub.plan as string,
            status: sub.status as string,
            current_period_end: (sub.current_period_end as string | null) ?? null,
          }
        : { plan: "free", status: "active", current_period_end: null as string | null },
      stats: {
        tripsCount: allTrips.length,
        totalKm: Math.round(totalKm),
        drivenKm: Math.round(drivenKm),
        lastActive: (tripsRow?.updated_at as string | null) ?? null,
      },
      vehicles,
    };
  });

export const adminListAuditLogFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } | undefined) =>
    z.object({ limit: z.number().min(1).max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const limit = data.limit ?? 50;
    const { data: rows, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const userIds = new Set<string>();
    for (const r of rows ?? []) {
      if (r.admin_id) userIds.add(r.admin_id as string);
      if (r.target_user_id) userIds.add(r.target_user_id as string);
    }
    const names = new Map<string, { display_name: string | null; username: string | null }>();
    if (userIds.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, username")
        .in("id", [...userIds]);
      for (const p of profs ?? []) {
        names.set(p.id as string, {
          display_name: (p.display_name as string | null) ?? null,
          username: (p.username as string | null) ?? null,
        });
      }
    }

    return {
      entries: (rows ?? []).map((r) => ({
        id: r.id as string,
        admin_id: r.admin_id as string,
        action: r.action as string,
        target_user_id: (r.target_user_id as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        metadata: (r.metadata as { from?: string | null; to?: string | null; validUntil?: string | null; role?: string | null } | null) ?? null,
        created_at: r.created_at as string,
        admin_name: names.get(r.admin_id as string)?.display_name ?? null,
        target_name: r.target_user_id ? names.get(r.target_user_id as string)?.display_name ?? null : null,
        target_username: r.target_user_id ? names.get(r.target_user_id as string)?.username ?? null : null,
      })),
    };
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
