import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Alias route — several CTAs across the app link to `/auth` (a convention
 * borrowed from Supabase scaffolds). We redirect into the real `/login`
 * route so those links never 404.
 *
 * If the caller already stored a `returnTo` path via `setReturnTo`,
 * the login page will consume it once the user signs in.
 */
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    mode: s.mode === "signup" ? "signup" : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (typeof window !== "undefined" && search.redirect) {
      try { sessionStorage.setItem("veiglede:returnTo", search.redirect); } catch { /* noop */ }
    }
    throw redirect({ to: search.mode === "signup" ? "/signup" : "/login" });
  },
  component: () => null,
});
