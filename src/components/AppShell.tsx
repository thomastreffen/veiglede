import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, Map, BookOpen, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Hjem", icon: Home, exact: true },
  { to: "/trips", label: "Mine turer", icon: Map },
  { to: "/roadbook", label: "Roadbook", icon: BookOpen },
  { to: "/settings", label: "Profil", icon: User },
];

export function VeigledeMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="h-6 w-6">
        <path d="M16 4 L29 28 L22 28 L16 16 L10 28 L3 28 Z" fill="oklch(0.78 0.17 65)" />
      </svg>
      <span className="font-display text-lg tracking-[0.08em]">VEIGLEDE</span>
    </span>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

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
