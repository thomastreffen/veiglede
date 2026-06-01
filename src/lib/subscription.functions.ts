import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Plan = "free" | "pro" | "gruppe";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
  if (!data || data.role !== "admin" || data.is_active === false) throw new Error("Forbidden");
}

/** Set the current user's own plan (Stripe will replace this later). */
export const setOwnPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: Plan }) =>
    z.object({ plan: z.enum(["free", "pro", "gruppe"]) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const periodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: context.userId,
          plan: data.plan,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: data.plan === "free" ? null : periodEnd,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    // If becoming gruppe owner, ensure owner row exists
    if (data.plan === "gruppe") {
      await supabaseAdmin
        .from("gruppe_members")
        .upsert(
          { gruppe_id: context.userId, user_id: context.userId, role: "owner" },
          { onConflict: "gruppe_id,user_id" },
        );
    }
    return { ok: true };
  });

export const cancelOwnSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Gruppe ---------- */

export const inviteGruppeMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { identifier: string }) =>
    z.object({ identifier: z.string().min(1).max(255) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // Must be a gruppe owner
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("plan, status").eq("user_id", context.userId).maybeSingle();
    if (!sub || sub.plan !== "gruppe" || sub.status !== "active") {
      throw new Error("Bare Gruppe-eiere kan invitere medlemmer.");
    }

    // Look up user by username first, then by email via auth admin
    const id = data.identifier.trim().toLowerCase();
    let targetUserId: string | null = null;

    const { data: byUsername } = await supabaseAdmin
      .from("profiles").select("id").eq("username", id).maybeSingle();
    if (byUsername) targetUserId = byUsername.id as string;

    if (!targetUserId && id.includes("@")) {
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const found = list?.users.find((u) => u.email?.toLowerCase() === id);
        if (found) targetUserId = found.id;
      } catch {
        // ignore
      }
    }

    if (!targetUserId) throw new Error("Fant ingen bruker med dette brukernavnet eller e-postadressen.");
    if (targetUserId === context.userId) throw new Error("Du er allerede eieren av denne gruppen.");

    // Count members (limit 20)
    const { count } = await supabaseAdmin
      .from("gruppe_members").select("id", { count: "exact", head: true }).eq("gruppe_id", context.userId);
    if ((count ?? 0) >= 20) throw new Error("Gruppen er full (maks 20 medlemmer).");

    const { error } = await supabaseAdmin
      .from("gruppe_members")
      .insert({ gruppe_id: context.userId, user_id: targetUserId, role: "member" });
    if (error) {
      if (error.code === "23505") throw new Error("Brukeren er allerede medlem.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeGruppeMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await supabaseAdmin
      .from("gruppe_members")
      .delete()
      .eq("gruppe_id", context.userId)
      .eq("user_id", data.userId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const leaveGruppeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gruppeId: string }) =>
    z.object({ gruppeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await supabaseAdmin
      .from("gruppe_members")
      .delete()
      .eq("gruppe_id", data.gruppeId)
      .eq("user_id", context.userId)
      .neq("role", "owner");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface GruppeMemberInfo {
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export const listMyGruppeFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    ownedGruppeId: string | null;
    memberOfGruppeId: string | null;
    members: GruppeMemberInfo[];
    ownerProfile: { username: string | null; displayName: string | null } | null;
  }> => {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("plan, status").eq("user_id", context.userId).maybeSingle();

    const ownedGruppeId = sub?.plan === "gruppe" && sub.status === "active" ? context.userId : null;

    // Membership in some other gruppe
    const { data: memberRows } = await supabaseAdmin
      .from("gruppe_members").select("gruppe_id, role").eq("user_id", context.userId);
    const memberOfGruppeId = (memberRows ?? []).find((r) => r.gruppe_id !== context.userId)?.gruppe_id as string | undefined ?? null;

    const targetGruppeId = ownedGruppeId ?? memberOfGruppeId;
    if (!targetGruppeId) {
      return { ownedGruppeId: null, memberOfGruppeId: null, members: [], ownerProfile: null };
    }

    const { data: rows } = await supabaseAdmin
      .from("gruppe_members")
      .select("user_id, role, joined_at")
      .eq("gruppe_id", targetGruppeId)
      .order("joined_at", { ascending: true });

    const userIds = [targetGruppeId, ...(rows ?? []).map((r) => r.user_id as string)];
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, username, display_name, avatar_url").in("id", userIds);
    const pm = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    const members: GruppeMemberInfo[] = [];
    if (!(rows ?? []).some((r) => r.user_id === targetGruppeId)) {
      const op = pm.get(targetGruppeId);
      members.push({
        userId: targetGruppeId,
        role: "owner",
        joinedAt: new Date(0).toISOString(),
        username: (op?.username as string | null) ?? null,
        displayName: (op?.display_name as string | null) ?? null,
        avatarUrl: (op?.avatar_url as string | null) ?? null,
      });
    }
    for (const r of rows ?? []) {
      const p = pm.get(r.user_id as string);
      members.push({
        userId: r.user_id as string,
        role: r.role as "owner" | "member",
        joinedAt: r.joined_at as string,
        username: (p?.username as string | null) ?? null,
        displayName: (p?.display_name as string | null) ?? null,
        avatarUrl: (p?.avatar_url as string | null) ?? null,
      });
    }

    const op = pm.get(targetGruppeId);
    return {
      ownedGruppeId,
      memberOfGruppeId,
      members,
      ownerProfile: op ? { username: (op.username as string | null) ?? null, displayName: (op.display_name as string | null) ?? null } : null,
    };
  });

/* ---------- Public: plan of a profile (for badge) ---------- */

export const getProfilePlanFn = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ plan: Plan }> => {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions").select("plan, status").eq("user_id", data.userId).maybeSingle();
    if (!sub || sub.status !== "active") return { plan: "free" };
    return { plan: sub.plan as Plan };
  });

/* ---------- Admin ---------- */

export const adminSubscriptionStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, current_period_end, created_at");

    const counts = { free: 0, pro: 0, gruppe: 0 };
    let mrr = 0;
    const paying: { userId: string; plan: Plan; renews: string | null; createdAt: string }[] = [];
    for (const r of rows ?? []) {
      const plan = r.plan as Plan;
      if (r.status === "active") {
        counts[plan] = (counts[plan] ?? 0) + 1;
        if (plan === "pro") mrr += 79;
        if (plan === "gruppe") mrr += 199;
        if (plan !== "free") {
          paying.push({
            userId: r.user_id as string,
            plan,
            renews: r.current_period_end as string | null,
            createdAt: r.created_at as string,
          });
        }
      } else {
        counts.free += 1;
      }
    }

    const userIds = paying.map((p) => p.userId);
    const profiles = userIds.length
      ? (await supabaseAdmin.from("profiles").select("id, username, display_name").in("id", userIds)).data ?? []
      : [];
    const pm = new Map(profiles.map((p) => [p.id as string, p]));

    return {
      counts,
      mrr,
      subscribers: paying.map((p) => {
        const prof = pm.get(p.userId);
        return {
          ...p,
          username: (prof?.username as string | null) ?? null,
          displayName: (prof?.display_name as string | null) ?? null,
        };
      }),
    };
  });

export const adminSetUserPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; plan: Plan }) =>
    z.object({
      userId: z.string().uuid(),
      plan: z.enum(["free", "pro", "gruppe"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const periodEnd = data.plan === "free" ? null : new Date(Date.now() + 30 * 86400_000).toISOString();
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: data.userId,
          plan: data.plan,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    if (data.plan === "gruppe") {
      await supabaseAdmin
        .from("gruppe_members")
        .upsert(
          { gruppe_id: data.userId, user_id: data.userId, role: "owner" },
          { onConflict: "gruppe_id,user_id" },
        );
    }
    return { ok: true };
  });
