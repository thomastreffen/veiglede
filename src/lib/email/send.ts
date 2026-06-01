import { supabase } from "@/integrations/supabase/client";

export interface SendTransactionalEmailParams {
  templateName:
    | "welcome"
    | "trip-invitation"
    | "trip-shared"
    | "account-deletion"
    | "trip-reminder";
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
}

/**
 * Enqueue a transactional email via the Lovable Emails send route.
 * Best-effort: never throws — failures are logged so trigger flows
 * (signup, invite, delete) don't break the user experience.
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "not_authenticated" };

    const res = await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateName: params.templateName,
        recipientEmail: params.recipientEmail,
        idempotencyKey: params.idempotencyKey,
        templateData: params.templateData ?? {},
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[email] send failed", res.status, text);
      return { ok: false, error: `${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[email] send error", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
