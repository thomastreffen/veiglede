import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("Forbidden");
  if (data.is_active === false) throw new Error("Account deactivated");
}

/* ============= PUBLIC: submit ticket from contact form ============= */

export const submitContactTicketFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().max(200).optional().nullable(),
        email: z.string().trim().email().max(255),
        subject: z.string().trim().max(200).optional().nullable(),
        message: z.string().trim().min(1).max(5000),
        source: z
          .enum(["kontaktskjema", "partner", "bruker", "annet"])
          .optional()
          .default("kontaktskjema"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Best-effort: associate to a known user by email
    let userId: string | null = null;
    try {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const match = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (match) userId = match.id;
    } catch {
      /* ignore */
    }

    const { data: ticket, error } = await supabaseAdmin
      .from("contact_tickets")
      .insert({
        source: data.source ?? "kontaktskjema",
        status: "ny",
        name: data.name ?? null,
        email: data.email,
        subject: data.subject ?? null,
        message: data.message,
        user_id: userId,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };

    // Best-effort: notify admins
    try {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      if (admins?.length) {
        await supabaseAdmin.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id as string,
            type: "contact_ticket",
            title: "Ny henvendelse",
            body: `${data.name ?? data.email}: ${(data.subject ?? data.message).slice(0, 80)}`,
            link: "/admin/henvendelser",
          })),
        );
      }
    } catch {
      /* ignore */
    }

    return { ok: true as const, id: ticket.id as string };
  });

/* ============= ADMIN: list, stats, update, reply ============= */

export const adminListTicketsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; source?: string } | undefined) =>
    z
      .object({
        status: z.enum(["alle", "ny", "åpen", "besvart", "lukket"]).optional(),
        source: z.enum(["alle", "kontaktskjema", "partner", "bruker", "annet"]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    let q = supabaseAdmin
      .from("contact_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "alle") q = q.eq("status", data.status);
    if (data.source && data.source !== "alle") q = q.eq("source", data.source);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const counts = { ny: 0, åpen: 0, besvart: 0, lukket: 0, total: 0 };
    const { data: allRows } = await supabaseAdmin
      .from("contact_tickets")
      .select("status");
    for (const r of allRows ?? []) {
      const s = (r as { status: string }).status as keyof typeof counts;
      if (s in counts) counts[s]++;
      counts.total++;
    }

    return { tickets: rows ?? [], counts };
  });

export const adminUnreadTicketsCountFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count } = await supabaseAdmin
      .from("contact_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "ny");
    return { count: count ?? 0 };
  });

export const adminUpdateTicketStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "ny" | "åpen" | "besvart" | "lukket" }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["ny", "åpen", "besvart", "lukket"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("contact_tickets")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReplyTicketFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reply: string }) =>
    z
      .object({
        id: z.string().uuid(),
        reply: z.string().trim().min(1).max(10000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: ticket, error: getErr } = await supabaseAdmin
      .from("contact_tickets")
      .select("*")
      .eq("id", data.id)
      .single();
    if (getErr || !ticket) throw new Error(getErr?.message ?? "Ticket not found");

    const { error: upErr } = await supabaseAdmin
      .from("contact_tickets")
      .update({
        admin_reply: data.reply,
        replied_at: new Date().toISOString(),
        status: "besvart",
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return {
      ok: true,
      ticket: {
        id: ticket.id as string,
        email: ticket.email as string,
        name: (ticket.name as string | null) ?? null,
        subject: (ticket.subject as string | null) ?? null,
        message: ticket.message as string,
      },
    };
  });
