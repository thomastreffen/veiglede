import { supabase } from "@/integrations/supabase/client";

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
    // Nuke every veiglede.* key except the visual theme preference.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("veiglede.") && k !== "veiglede.theme") toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    // Also wipe sessionStorage just in case.
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("veiglede.")) sessionStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
