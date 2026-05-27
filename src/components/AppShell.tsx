import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Compass, Map, BookOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Home", icon: Compass, exact: true },
  { to: "/trips", label: "Trips", icon: Map },
  { to: "/roadbook", label: "Roadbook", icon: BookOpen },
  { to: "/settings", label: "Profile", icon: User },
];

export function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-block h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center font-serif text-lg leading-none">r</span>
            <span className="font-serif text-2xl leading-none">roadbook</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "px-3 py-1.5 rounded-full transition-colors",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 pb-28 md:pb-12 pt-2">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-4">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px]",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
