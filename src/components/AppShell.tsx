import { useEffect } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Map, BookOpen, User, Plus, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/account";
import { VeigledeLogo } from "@/components/VeigledeLogo";

const nav = [
  { to: "/", label: "Hjem", icon: Home, exact: true },
  { to: "/trips", label: "Mine turer", icon: Map },
  { to: "/roadbook", label: "Roadbook", icon: BookOpen },
  { to: "/settings", label: "Profil", icon: User },
];

/** Back-compat alias. New code should import VeigledeLogo directly. */
export function VeigledeMark({ className }: { className?: string }) {
  return <VeigledeLogo size="md" className={className} />;
}

export function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  // Onboarding gate: send freshly-logged-in users who haven't onboarded
  // to /onboarding once.
  useEffect(() => {
    if (!user) return;
    if (pathname === "/onboarding") return;
    let cancelled = false;
    (async () => {
      const status = await getOnboardingStatus(user.id);
      if (cancelled) return;
      // Only redirect when we are CERTAIN the user is new. On unknown/error
      // (transient RLS / network), leave the returning user where they are.
      if (status.kind === "new") {
        const next = pathname && pathname !== "/" ? pathname : "/trips";
        navigate({ to: "/onboarding", search: { next }, replace: true } as never);
      }
    })();
    return () => { cancelled = true; };
  }, [user, pathname, navigate]);



  return (
    <div className="min-h-screen flex flex-col bg-background bg-glow-orange">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-3.5">
          <Link to="/"><VeigledeMark /></Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full transition-colors",
                    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {n.label}
                </Link>
              );
            })}
            <Link to="/trips/new" className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
              <Plus className="h-4 w-4" /> Ny tur
            </Link>
            {user ? (
              <Link to="/settings" className="ml-1 grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground text-sm font-semibold" title={user.email ?? ""}>
                {(user.email ?? "?").charAt(0).toUpperCase()}
              </Link>
            ) : (
              <>
                <span
                  title="Du utforsker i demo-modus — data lagres bare på denne enheten"
                  className="ml-1 hidden lg:inline-flex items-center rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Demo
                </span>
                <Link to="/login" className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                  <LogIn className="h-4 w-4" /> Logg inn
                </Link>
              </>
            )}

          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 md:px-6 pb-32 md:pb-12 pt-2">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5 items-end">
          {nav.slice(0, 2).map((n) => <NavItem key={n.to} n={n} pathname={pathname} />)}
          <li className="flex justify-center -mt-6">
            <Link to="/trips/new" className="grid place-items-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-4 border-background">
              <Plus className="h-6 w-6" strokeWidth={3} />
            </Link>
          </li>
          {nav.slice(2).map((n) => <NavItem key={n.to} n={n} pathname={pathname} />)}
        </ul>
      </nav>
    </div>
  );
}

function NavItem({ n, pathname }: { n: typeof nav[number]; pathname: string }) {
  const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
  const Icon = n.icon;
  return (
    <li>
      <Link to={n.to} className={cn(
        "flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-wider",
        active ? "text-primary" : "text-muted-foreground"
      )}>
        <Icon className="h-5 w-5" />
        <span>{n.label}</span>
      </Link>
    </li>
  );
}
