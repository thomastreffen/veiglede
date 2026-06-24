import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";

/**
 * Soft-delete: record a deletion request with a 30-day restore window
 * and send an email with the restore link. Signs the user out.
 */
export async function requestAccountDeletion(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");
  const email = user.email || "";

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: user.id, user_email: email })
    .select("restore_token")
    .single();
  if (error) throw error;

  const token = (data as { restore_token: string }).restore_token;
  const restoreUrl = `https://veiglede.no/restore/${token}`;
  if (email) {
    await sendTransactionalEmail({
      templateName: "account-deletion",
      recipientEmail: email,
      idempotencyKey: `account-deletion-${token}`,
      templateData: { restoreUrl },
    });
  }
  try {
    const { signOut } = await import("@/lib/auth");
    await signOut();
  } catch { /* noop */ }
}

export type OnboardingStatus =
  | { kind: "onboarded" }
  | { kind: "new" }
  | { kind: "unknown" }; // error / transient — do NOT redirect

/**
 * Resolve whether the signed-in user has completed onboarding.
 * Critical: we ONLY treat the user as "new" when we have a confirmed,
 * error-free response with no onboarded_at. Anything else returns "unknown"
 * so the UI does not bounce returning users back through onboarding.
 */
export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { kind: "unknown" };
    if (data?.onboarded_at) return { kind: "onboarded" };
    // Row may not exist yet on a brand-new signup (trigger race). Try once more.
    if (!data) {
      const retry = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", userId)
        .maybeSingle();
      if (retry.error) return { kind: "unknown" };
      if (retry.data?.onboarded_at) return { kind: "onboarded" };
      // Profile exists but no onboarded_at → genuinely new, or row missing → new
      return { kind: "new" };
    }
    return { kind: "new" };
  } catch {
    return { kind: "unknown" };
  }
}

/**
 * Permanently deletes the current user's account and ALL local Veiglede data
 * from this browser. After this returns, the next sign-in (even with the
 * same Google account) must start fresh — no old vehicles, trips or prefs
 * should be re-migrated up to the cloud.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  // End the local session FIRST so cloud-sync drops its currentUserId and
  // any pending debounced pushes won't write the about-to-be-cleared local
  // data back into a fresh login.
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  try {
    // Nuke every veiglede.* key except the visual theme preference and
    // any cross-session notice flags (e.g. so the next sign-in can show
    // "Vi har satt opp en ny profil" instead of a silent re-onboarding).
    const PRESERVE = new Set(["veiglede.theme"]);
    const isPreserved = (k: string) =>
      PRESERVE.has(k) || k.startsWith("veiglede.notice.");
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("veiglede.") && !isPreserved(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("veiglede.") && !isPreserved(k)) sessionStorage.removeItem(k);
    }
    // Mark the browser so the next onboarding can explain what's happening.
    localStorage.setItem("veiglede.notice.profileDeleted", "1");
  } catch { /* ignore */ }
}

/**
 * Returns true (and clears the flag) if the previous action on this browser
 * was an account deletion. Used by onboarding to show a reassuring banner
 * when the user signs back in with the same Google account.
 */
export function consumeProfileDeletedNotice(): boolean {
  try {
    const v = localStorage.getItem("veiglede.notice.profileDeleted");
    if (v) localStorage.removeItem("veiglede.notice.profileDeleted");
    return v === "1";
  } catch { return false; }
}
