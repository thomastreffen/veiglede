// Trip invites — Fellestur v1.
// Wraps the trip_invites table and the two SECURITY DEFINER RPCs
// (get_shared_trip, join_trip_with_token) defined in the database.

import { supabase } from "@/integrations/supabase/client";

export type InviteStatus = "invited" | "opened" | "joined" | "revoked";

export interface TripInvite {
  id: string;
  trip_id: string;
  owner_user_id: string;
  invited_email: string | null;
  invite_token: string;
  status: InviteStatus;
  joined_user_id: string | null;
  created_at: string;
  opened_at: string | null;
  joined_at: string | null;
}

export interface SharedTripPayload {
  invite: TripInvite;
  trip: unknown | null;
  days: unknown[];
  stops: unknown[];
}

const PENDING_KEY = "veiglede.pendingInvite";

function genToken(): string {
  const a = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  // url-safe base64
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function inviteUrl(token: string): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : "https://veiglede.no";
  return `${base}/invite/${token}`;
}

export async function createInvite(
  tripId: string,
  email?: string | null,
): Promise<TripInvite> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");

  const token = genToken();
  const { data, error } = await supabase
    .from("trip_invites")
    .insert({
      trip_id: tripId,
      owner_user_id: userData.user.id,
      invited_email: email?.trim() || null,
      invite_token: token,
      status: "invited",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TripInvite;
}

export async function listInvitesForTrip(tripId: string): Promise<TripInvite[]> {
  const { data, error } = await supabase
    .from("trip_invites")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TripInvite[];
}

export async function revokeInvite(id: string): Promise<void> {
  const { error } = await supabase
    .from("trip_invites")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInvite(id: string): Promise<void> {
  const { error } = await supabase.from("trip_invites").delete().eq("id", id);
  if (error) throw error;
}

export async function getSharedTrip(token: string): Promise<SharedTripPayload | null> {
  const { data, error } = await supabase.rpc("get_shared_trip", { p_token: token });
  if (error) throw error;
  if (!data) return null;
  return data as SharedTripPayload;
}

export async function joinTripWithToken(token: string): Promise<TripInvite> {
  const { data, error } = await supabase.rpc("join_trip_with_token", {
    p_token: token,
  });
  if (error) throw error;
  return data as TripInvite;
}

// --- pending invite handoff (for the post-login resume) ---

export function setPendingInvite(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, token);
  } catch {
    /* no-op */
  }
}

export function consumePendingInvite(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PENDING_KEY);
    if (v) window.localStorage.removeItem(PENDING_KEY);
    return v;
  } catch {
    return null;
  }
}
