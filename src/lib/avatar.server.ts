import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const AVATAR_BUCKET = "profile-avatars";
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — server-rendered pages re-sign on each request

function isStoragePath(v: string | null | undefined): v is string {
  if (!v) return false;
  return !/^(https?:|data:|blob:)/i.test(v);
}

/** Resolve a stored avatar value to a displayable URL on the server. */
export async function signAvatarServer(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!isStoragePath(value)) return value;
  const { data } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(value, SIGN_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/** Sign many at once, preserving null/undefined. */
export async function signAvatarsServer(values: Array<string | null | undefined>): Promise<Array<string | null>> {
  return Promise.all(values.map((v) => signAvatarServer(v)));
}
