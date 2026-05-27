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

/** Permanently deletes the current user's account and all owned cloud data. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  // End the local session and wipe local demo data so the device resets.
  await supabase.auth.signOut();
  try {
    localStorage.removeItem("veiglede.v4");
    localStorage.removeItem("veiglede.vehicles.v1");
    localStorage.removeItem("veiglede.vehicles.seed.v2");
    localStorage.removeItem("veiglede.profile.v1");
  } catch { /* ignore */ }
}
