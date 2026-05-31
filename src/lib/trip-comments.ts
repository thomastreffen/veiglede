// Comments on shared trips — visible only to trip members (owner + accepted invitees).
import { supabase } from "@/integrations/supabase/client";

export interface TripComment {
  id: string;
  trip_id: string;
  user_id: string;
  user_name: string | null;
  user_avatar_url: string | null;
  content: string;
  created_at: string;
}

export const MAX_COMMENT_LEN = 500;

export async function listTripComments(tripId: string): Promise<TripComment[]> {
  const { data, error } = await supabase
    .from("trip_comments")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TripComment[];
}

export async function addTripComment(
  tripId: string,
  content: string,
): Promise<TripComment> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Tom kommentar");
  if (trimmed.length > MAX_COMMENT_LEN) throw new Error("For lang kommentar");

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error("Not authenticated");

  // Read display info from profile for nicer rendering without join.
  let user_name: string | null = userData.user.email ?? null;
  let user_avatar_url: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profile) {
    user_name = profile.display_name ?? user_name;
    user_avatar_url = profile.avatar_url ?? null;
  }

  const { data, error } = await supabase
    .from("trip_comments")
    .insert({
      trip_id: tripId,
      user_id: userData.user.id,
      user_name,
      user_avatar_url,
      content: trimmed,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TripComment;
}

export async function deleteTripComment(id: string): Promise<void> {
  const { error } = await supabase.from("trip_comments").delete().eq("id", id);
  if (error) throw error;
}
