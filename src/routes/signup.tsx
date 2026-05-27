import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthButtons } from "@/components/AuthButtons";
import { useAuth } from "@/lib/auth";
import { VeigledeMark } from "@/components/AppShell";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Opprett konto — Veiglede" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    // Don't force onboarding here — the AppShell gate + auth callback
    // decide based on profiles.onboarded_at, so existing Google users
    // who click "Opprett konto" land in /trips, not onboarding.
    if (user) navigate({ to: "/trips", replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background bg-glow-orange flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8"><VeigledeMark /></Link>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1/70 backdrop-blur p-6 md:p-8 shadow-xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Bli med</p>
        <h1 className="mt-2 font-display text-2xl uppercase">Opprett din konto</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gratis. Lagre turer, kjøretøy og kjørestil på tvers av enheter.</p>
        <div className="mt-6"><AuthButtons mode="signup" redirectTo="/trips" /></div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Har du konto? <Link to="/login" className="text-foreground underline">Logg inn</Link>
        </p>
      </div>
    </div>
  );
}
