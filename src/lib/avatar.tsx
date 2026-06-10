import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "profile-avatars";

/** A value is a storage path (not an absolute URL) when it doesn't start with http(s):// or data:. */
export function isAvatarStoragePath(v: string | null | undefined): v is string {
  if (!v) return false;
  return !/^(https?:|data:|blob:)/i.test(v);
}

const cache = new Map<string, { url: string; expires: number }>();
const SIGN_TTL_SECONDS = 60 * 60; // 1 hour signed URL
const CACHE_MARGIN_MS = 5 * 60 * 1000;

/**
 * Resolve a stored avatar value to a displayable URL.
 * - http(s)/data/blob URLs (e.g. Google OAuth) are returned as-is.
 * - Storage paths under the profile-avatars bucket are signed on demand.
 *   Signed URLs are cached in memory until shortly before they expire,
 *   so we re-sign safely on refresh/login.
 */
export async function resolveAvatarUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!isAvatarStoragePath(value)) return value;

  const cached = cache.get(value);
  if (cached && cached.expires - CACHE_MARGIN_MS > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(value, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(value, { url: data.signedUrl, expires: Date.now() + SIGN_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

/** React helper that resolves an avatar value to a renderable URL. */
export function useResolvedAvatarUrl(value: string | null | undefined): string | null {
  // For raw http/data URLs we can render synchronously to avoid a flash.
  const initial = !value || isAvatarStoragePath(value) ? null : value;
  const [url, setUrl] = useState<string | null>(initial);

  useEffect(() => {
    let cancelled = false;
    if (!value) { setUrl(null); return; }
    if (!isAvatarStoragePath(value)) { setUrl(value); return; }
    resolveAvatarUrl(value).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [value]);

  return url;
}

interface AvatarImgProps {
  /** Either a storage path (bucket-relative) or an absolute URL. */
  value: string | null | undefined;
  alt?: string;
  className?: string;
}

/** Renders an avatar image, signing the storage path lazily when needed. */
export function AvatarImg({ value, alt = "", className }: AvatarImgProps) {
  const url = useResolvedAvatarUrl(value);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}
