import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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
    (async () => {
      // Supabase auto-detects session from URL (magic link, email confirm, OAuth).
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        // Decide where to send the user — onboarding if they haven't completed it.
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded_at")
          .eq("id", data.session.user.id)
          .maybeSingle();
        navigate({ to: profile?.onboarded_at ? "/trips" : "/onboarding", replace: true });
      } else {
        // No session yet — wait briefly for onAuthStateChange to fire.
        setTimeout(() => {
          if (!cancelled) navigate({ to: "/login", replace: true });
        }, 1500);
      }
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
