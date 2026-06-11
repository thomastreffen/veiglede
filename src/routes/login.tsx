import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthButtons } from "@/components/AuthButtons";
import { useAuth } from "@/lib/auth";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { consumePendingInvite } from "@/lib/trip-invites";
import { consumeReturnTo } from "@/lib/return-to";

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
      navigate({ to: "/join/$token", params: { token: pending }, replace: true });
      return;
    }
    const returnTo = consumeReturnTo();
    if (returnTo) {
      // External navigation so the returnTo path can be anything in the app
      // (curated inspiration pages, shared trips, etc.) without listing routes.
      window.location.replace(returnTo);
      return;
    }
    navigate({ to: "/trips", replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background bg-glow-orange flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-10"><VeigledeLogo size="lg" withTagline /></Link>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1/70 backdrop-blur p-6 md:p-8 shadow-xl">
        <h1 className="font-display text-2xl uppercase">Velkommen tilbake</h1>
        <p className="mt-1 text-sm text-muted-foreground">Logg inn for å hente turene dine.</p>
        <div className="mt-4 flex gap-2">
          <Link to="/signup" className="flex-1 rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-medium text-center text-muted-foreground">
            Ny bruker
          </Link>
          <Link to="/login" className="flex-1 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-center text-primary">
            Logg inn
          </Link>
        </div>
        <div className="mt-6"><AuthButtons mode="signin" /></div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Tilbake til demo</Link>
        </p>
      </div>
    </div>
  );
}
