import { supabase } from "@/integrations/supabase/client";
import { compressImageToBlob } from "@/lib/vehicle-photos";

const BUCKET = "profile-avatars";
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export type UploadAvatarResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Upload an avatar to the private profile-avatars bucket and return its
 * storage path. We intentionally do NOT return or persist a signed URL —
 * the storage path is what should be stored in `profiles.avatar_url` so
 * that fresh signed URLs can be generated on demand at render time.
 */
export async function uploadProfileAvatar(file: File, userId: string): Promise<UploadAvatarResult> {
  if (!ACCEPT.includes(file.type)) return { ok: false, error: "Bildet må være JPG, PNG eller WebP." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Maks filstørrelse er 5 MB." };

  const blob = await compressImageToBlob(file, 512, 0.85).catch(() => null);
  if (!blob) return { ok: false, error: "Kunne ikke lese bildet." };

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  return { ok: true, path };
}

/** Best-effort cleanup of previously uploaded avatar files for this user. */
export async function cleanupOldAvatars(userId: string, keepPath?: string): Promise<void> {
  const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
  if (!data?.length) return;
  const remove = data
    .map((o) => `${userId}/${o.name}`)
    .filter((p) => p !== keepPath);
  if (remove.length) await supabase.storage.from(BUCKET).remove(remove);
}
