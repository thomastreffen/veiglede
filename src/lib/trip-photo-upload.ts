import { supabase } from "@/integrations/supabase/client";

export async function uploadTripPhoto(params: {
  file: File;
  tripId: string;
  userId: string;
  stopId?: string | null;
}): Promise<{ id: string; url: string; path: string } | null> {
  const { file, tripId, userId, stopId } = params;
  console.log("1. Starting upload", file.name, file.size);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${tripId}/${Date.now()}_${safeName}`;
  console.log("2. Uploading to path:", path);

  const { data, error } = await supabase.storage
    .from("trip-photos")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if (error) {
    console.error("3. Storage error:", error.message);
    return null;
  }
  console.log("4. Upload success:", data.path);

  const { data: pub } = supabase.storage.from("trip-photos").getPublicUrl(data.path);
  console.log("5. Public URL:", pub.publicUrl);

  const { data: row, error: dbErr } = await supabase
    .from("trip_photos")
    .insert({ trip_id: tripId, stop_id: stopId ?? null, user_id: userId, url: pub.publicUrl, path: data.path })
    .select("id")
    .single();

  if (dbErr) {
    console.error("6. DB error:", dbErr.message);
    return null;
  }
  console.log("7. Saved to DB:", row?.id);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("trip-photos:refresh", { detail: { tripId } }));
  }

  return { id: row.id, url: pub.publicUrl, path: data.path };
}
