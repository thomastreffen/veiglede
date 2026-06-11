import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthButtons } from "@/components/AuthButtons";
import { useAuth } from "@/lib/auth";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { consumeReturnTo } from "@/lib/return-to";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Opprett konto — Veiglede" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    const returnTo = consumeReturnTo();
    if (returnTo) {
      window.location.replace(returnTo);
      return;
    }
    navigate({ to: "/trips", replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background bg-glow-orange flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-10"><VeigledeLogo size="lg" withTagline /></Link>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-1/70 backdrop-blur p-6 md:p-8 shadow-xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Bli med</p>
        <h1 className="mt-2 font-display text-2xl uppercase">Opprett din konto</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gratis. Lagre turer, kjøretøy og kjørestil på tvers av enheter.</p>
        <div className="mt-4 flex gap-2">
          <Link to="/signup" className="flex-1 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-center text-primary">
            Ny bruker
          </Link>
          <Link to="/login" className="flex-1 rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm font-medium text-center text-muted-foreground">
            Logg inn
          </Link>
        </div>
        <div className="mt-6"><AuthButtons mode="signup" redirectTo="/trips" /></div>
      </div>
    </div>
  );
}
