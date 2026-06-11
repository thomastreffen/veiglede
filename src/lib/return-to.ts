/**
 * Tiny helper to round-trip a "return to" path across the auth flow.
 * Used so anonymous CTAs (Vil kjøre, Kopier, Tilpass) can send the user
 * to /auth and bring them back to the same curated/inspiration page.
 */
const KEY = "veiglede:returnTo";

export function setReturnTo(path: string): void {
  try {
    if (typeof window === "undefined") return;
    if (!path || !path.startsWith("/")) return;
    sessionStorage.setItem(KEY, path);
  } catch {
    // ignore — sessionStorage may be unavailable
  }
}

export function consumeReturnTo(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    if (v && v.startsWith("/")) return v;
    return null;
  } catch {
    return null;
  }
}
