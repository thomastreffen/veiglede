import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingStatus } from "@/lib/account";
import { sendTransactionalEmail } from "@/lib/email/send";
import { consumePendingInvite } from "@/lib/trip-invites";
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
    let finished = false;
    let deciding = false;
    let cleanupAuth: (() => void) | null = null;
    let cleanupTimer: (() => void) | null = null;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const rawNext = params.get("next") || "/trips";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/trips";
    const code = params.get("code");
    const callbackError = params.get("error") || hashParams.get("error");

    console.info("[auth-callback] received", {
      hasCode: !!code,
      hasState: params.has("state"),
      error: callbackError ?? undefined,
      next,
      hasHashAccessToken: hashParams.has("access_token"),
      hasHashRefreshToken: hashParams.has("refresh_token"),
    });

    const decide = async () => {
      if (finished || deciding) return finished;
      deciding = true;
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) { deciding = false; return false; }
      if (error) { setError(error.message); return true; }
      if (!data.session) { deciding = false; return false; }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (cancelled) { deciding = false; return false; }
      if (userError || !userData.user) { deciding = false; return false; }
      const status = await getOnboardingStatus(data.session.user.id);
      if (cancelled) { deciding = false; return true; }
      finished = true;
      // Default to sending the user into the app. Only divert to onboarding
      // when we are CERTAIN this user has never onboarded.
      if (status.kind === "new") {
        // Best-effort welcome email — dedupe via profiles.welcome_email_sent_at
        try {
          const userId = data.session.user.id;
          const email = data.session.user.email;
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, welcome_email_sent_at")
            .eq("id", userId)
            .maybeSingle();
          if (email && !prof?.welcome_email_sent_at) {
            await sendTransactionalEmail({
              templateName: "welcome",
              recipientEmail: email,
              idempotencyKey: `welcome-${userId}`,
              templateData: { name: prof?.display_name ?? undefined },
            });
            await supabase
              .from("profiles")
              .update({ welcome_email_sent_at: new Date().toISOString() })
              .eq("id", userId);
          }
        } catch { /* noop */ }
        const pendingInvite = consumePendingInvite();
        if (pendingInvite) {
          navigate({ to: "/join/$token", params: { token: pendingInvite }, replace: true });
        } else {
          navigate({ to: "/onboarding", search: { next }, replace: true } as never);
        }
      } else {
        const pendingInvite = consumePendingInvite();
        if (pendingInvite) {
          window.location.replace(`/join/${pendingInvite}`);
        } else {
          window.location.replace(next);
        }
      }
      deciding = false;
      return true;
    };

    (async () => {
      if (callbackError) {
        setError(params.get("error_description") || hashParams.get("error_description") || callbackError);
        return;
      }
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !cancelled) {
          console.warn("[auth-callback] code exchange failed", exchangeError.message);
          setError(exchangeError.message);
        }
      } else {
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError && !cancelled) {
            console.warn("[auth-callback] hash session failed", setSessionError.message);
            setError(setSessionError.message);
          }
        }
      }
      if (await decide()) return;
      const sub = supabase.auth.onAuthStateChange(async (event) => {
        console.info("[auth-callback] auth event", event);
        await decide();
      });
      cleanupAuth = () => sub.data.subscription.unsubscribe();
      const started = Date.now();
      const interval = window.setInterval(async () => {
        if (cancelled) return;
        if (await decide()) {
          window.clearInterval(interval);
          sub.data.subscription.unsubscribe();
          return;
        }
        if (Date.now() - started > 12000) {
          window.clearInterval(interval);
          sub.data.subscription.unsubscribe();
          setError("Innloggingen fullførte ikke. Prøv igjen.");
          navigate({ to: "/login", replace: true });
        }
      }, 500);
      cleanupTimer = () => window.clearInterval(interval);
    })();
    return () => { cancelled = true; cleanupTimer?.(); cleanupAuth?.(); };
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

