import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthButtons } from "@/components/AuthButtons";
import { useAuth } from "@/lib/auth";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { consumePendingInvite } from "@/lib/trip-invites";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Logg inn — Veiglede" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const pending = consumePendingInvite();
    if (pending) {
      navigate({ to: "/invite/$token", params: { token: pending }, replace: true });
    } else {
      navigate({ to: "/trips", replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background bg-glow-orange flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-10"><VeigledeLogo size="lg" withTagline /></Link>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1/70 backdrop-blur p-6 md:p-8 shadow-xl">
        <h1 className="font-display text-2xl uppercase">Velkommen tilbake</h1>
        <p className="mt-1 text-sm text-muted-foreground">Logg inn for å hente turene dine.</p>
        <div className="mt-6"><AuthButtons mode="signin" /></div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ikke registrert? <Link to="/signup" className="text-foreground underline">Opprett konto</Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Tilbake til demo</Link>
        </p>
      </div>
    </div>
  );
}
