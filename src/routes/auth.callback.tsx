import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingStatus } from "@/lib/account";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Logger inn — Veiglede" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const rawNext = params.get("next") || "/trips";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/trips";

    const decide = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return false;
      if (error) { setError(error.message); return true; }
      if (!data.session) return false;
      const status = await getOnboardingStatus(data.session.user.id);
      if (cancelled) return true;
      // Default to sending the user into the app. Only divert to onboarding
      // when we are CERTAIN this user has never onboarded.
      if (status.kind === "new") {
        navigate({ to: "/onboarding", search: { next }, replace: true } as never);
      } else {
        window.location.replace(next);
      }
      return true;
    };

    (async () => {
      if (await decide()) return;
      const sub = supabase.auth.onAuthStateChange(async () => { await decide(); });
      setTimeout(() => {
        if (!cancelled) {
          sub.data.subscription.unsubscribe();
          navigate({ to: "/login", replace: true });
        }
      }, 3000);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">{error ?? "Logger deg inn…"}</p>
      </div>
    </div>
  );
}

