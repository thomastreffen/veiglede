import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { amIAdminFn } from "@/lib/admin.functions";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Veiglede" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV: { to: string; label: string; emoji: string; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", exact: true, emoji: "📊" },
  { to: "/admin/users", label: "Brukere", emoji: "👥" },
  { to: "/admin/trips", label: "Turer", emoji: "🗺️" },
  { to: "/admin/partners", label: "Partnere", emoji: "🤝" },
  { to: "/admin/advertisers", label: "Annonsører", emoji: "📢" },
  { to: "/admin/subscriptions", label: "Abonnementer", emoji: "💳" },
  { to: "/admin/benefits", label: "Fordeler", emoji: "🎁" },
  { to: "/admin/audience", label: "Målgruppe", emoji: "📈" },
  { to: "/admin/settings", label: "Innstillinger", emoji: "⚙️" },
];

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const probe = useServerFn(amIAdminFn);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["am-i-admin", user?.id],
    queryFn: () => probe(),
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (data && !data.isAdmin) {
      navigate({ to: "/", replace: true });
    }
    if (isError) navigate({ to: "/", replace: true });
  }, [loading, user, data, isError, navigate]);

  if (loading || !user || isLoading || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">
        <p className="text-sm">Verifiserer tilgang…</p>
      </div>
    );
  }
  if (!data.isAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-screen">
        <aside className="border-r border-slate-800 bg-slate-900/60 md:sticky md:top-0 md:h-screen flex flex-col">
          <div className="p-5 border-b border-slate-800">
            <Link to="/" className="inline-flex items-center gap-2">
              <VeigledeLogo size="sm" />
            </Link>
            <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-slate-500">Admin-panel</p>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <span className="text-base leading-none">{n.emoji}</span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-800">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800/60"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Tilbake til Veiglede
            </Link>
          </div>
        </aside>

        <main className="p-5 md:p-8 max-w-6xl w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
