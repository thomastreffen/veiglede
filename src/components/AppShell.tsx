import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Home, Map, User, Plus, LogIn, Car, Compass, Shield, Gift } from "lucide-react";
import { TripQuickAddSheet } from "@/components/TripQuickAddSheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/account";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { HelpBot } from "@/components/HelpBot";
import { useBrowserNotifications } from "@/lib/useBrowserNotifications";
import { amIAdminFn } from "@/lib/admin.functions";
import { useT } from "@/i18n/provider";
import type { Dict } from "@/i18n/locales/nb";

const FORDELER_LAUNCH = new Date("2026-06-01").getTime();
const isFordelerNew = () => Date.now() - FORDELER_LAUNCH < 30 * 24 * 60 * 60 * 1000;

type NavItemDef = {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: string;
};

function buildNav(t: Dict): NavItemDef[] {
  const n = t.app.nav;
  return [
    { to: "/", label: n.home, icon: Home },
    { to: "/explore", label: n.explore, icon: Compass },
    { to: "/fordeler", label: n.fordeler, icon: Gift, badge: n.fordelerBadge },
    { to: "/trips", label: n.myTrips, icon: Map },
    { to: "/garage", label: n.garage, icon: Car },
    { to: "/settings", label: n.profile, icon: User },
  ];
}

/** Back-compat alias. New code should import VeigledeLogo directly. */
export function VeigledeMark({ className }: { className?: string }) {
  return <VeigledeLogo size="md" className={className} />;
}

export function AppShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useBrowserNotifications();
  const amIAdmin = useServerFn(amIAdminFn);
  const t = useT();
  const nav = useMemo(() => buildNav(t), [t]);
  const { data: adminInfo } = useQuery({
    queryKey: ["am-i-admin", user?.id ?? "anon"],
    queryFn: () => amIAdmin(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = !!adminInfo?.isAdmin;

  // Onboarding gate: send freshly-logged-in users who haven't onboarded
  // to /onboarding once.
  useEffect(() => {
    if (!user) return;
    if (pathname === "/onboarding") return;
    let cancelled = false;
    (async () => {
      const status = await getOnboardingStatus(user.id);
      if (cancelled) return;
      if (status.kind === "new") {
        const next = pathname && pathname !== "/" ? pathname : "/trips";
        navigate({ to: "/onboarding", search: { next }, replace: true } as never);
      }
    })();
    return () => { cancelled = true; };
  }, [user, pathname, navigate]);

  // Standalone PWA: when launched from home screen and authed, send "/" to "/trips".
  useEffect(() => {
    if (!user) return;
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      navigate({ to: "/trips", replace: true });
    }
  }, [user, pathname, navigate]);

  const isOnboarding = pathname === "/onboarding";

  if (isOnboarding) {
    return (
      <div className="min-h-screen flex flex-col bg-background bg-glow-orange">
        <header className="border-b border-border/60">
          <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-3.5">
            <Link to="/"><VeigledeMark /></Link>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 md:px-6 py-2">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background bg-glow-orange">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-6 py-3.5">
          <Link to="/"><VeigledeMark /></Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-surface-2 text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                className="px-3.5 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
              >
                {n.label}
                {n.badge && isFordelerNew() && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">{n.badge}</span>
                )}
              </Link>
            ))}
            <Link to="/trips/new" search={() => ({ restoreDraft: "fresh", ts: String(Date.now()) })} className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
              <Plus className="h-4 w-4" /> {t.app.nav.newTrip}
            </Link>
            {user && isAdmin && (
              <Link
                to="/admin"
                className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2"
                title={t.app.nav.adminTitle}
              >
                <Shield className="h-4 w-4" /> {t.app.nav.admin}
              </Link>
            )}
            {user ? (
              <>
                <NotificationBell onIncoming={notify} />
                <Link to="/settings" className="ml-1 grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground text-sm font-semibold" title={user.email ?? ""}>
                  {(user.email ?? "?").charAt(0).toUpperCase()}
                </Link>
              </>
            ) : (
              <>
                <span
                  title={t.app.nav.demoTooltip}
                  className="ml-1 hidden lg:inline-flex items-center rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {t.app.nav.demo}
                </span>
                <Link to="/login" className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2">
                  <LogIn className="h-4 w-4" /> {t.app.nav.login}
                </Link>
              </>
            )}

          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 md:px-6 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-12 pt-2">
        <Outlet />
      </main>

      <footer className="hidden md:block border-t border-border/40 mt-8">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-5 flex items-center justify-between text-xs text-muted-foreground">
          <span>© Veiglede</span>
          <Link to="/hjelp" className="hover:text-foreground">Trenger du hjelp?</Link>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <MobileBottomNav pathname={pathname} nav={nav} quickActionsLabel={t.app.nav.quickActions} />

      <HelpBot />
    </div>
  );
}

function MobileBottomNav({
  pathname,
  nav,
  quickActionsLabel,
}: {
  pathname: string;
  nav: NavItemDef[];
  quickActionsLabel: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const tripMatch = pathname.match(/^\/trips\/([^/]+)/);
  const insideTrip = !!tripMatch && tripMatch[1] !== "new";
  const currentTripId = insideTrip ? tripMatch![1] : null;
  const mobileNav = nav.filter((n) => n.to !== "/fordeler" && n.to !== "/garage");

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5 items-end">
          {mobileNav.slice(0, 2).map((n) => <NavItem key={n.to} n={n} />)}
          <li className="flex justify-center -mt-6">
            {insideTrip ? (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={quickActionsLabel}
                className="grid place-items-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-4 border-background"
              >
                <Plus className="h-6 w-6" strokeWidth={3} />
              </button>
            ) : (
              <Link to="/trips/new" search={() => ({ restoreDraft: "fresh", ts: String(Date.now()) })} className="grid place-items-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-4 border-background">
                <Plus className="h-6 w-6" strokeWidth={3} />
              </Link>
            )}
          </li>
          {mobileNav.slice(2).map((n) => <NavItem key={n.to} n={n} />)}
        </ul>
      </nav>
      {currentTripId && (
        <TripQuickAddSheet
          tripId={currentTripId}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}

function NavItem({ n }: { n: NavItemDef }) {
  const Icon = n.icon;
  return (
    <li>
      <Link
        to={n.to}
        activeOptions={{ exact: true }}
        activeProps={{ className: "text-primary" }}
        inactiveProps={{ className: "text-muted-foreground" }}
        className={cn("flex flex-col items-center gap-0.5 py-2 text-[9px] uppercase tracking-wide w-full min-w-0")}
      >
        <Icon className="h-5 w-5" />
        <span className="text-center leading-tight w-full whitespace-nowrap text-[8px] uppercase tracking-normal">{n.label}</span>
      </Link>
    </li>
  );
}
