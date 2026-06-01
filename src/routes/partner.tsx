import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { useAuth, signOut } from "@/lib/auth";

export const Route = createFileRoute("/partner")({
  component: PartnerLayout,
});

function PartnerLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const inDashboard = location.pathname.startsWith("/partner/dashboard");

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a]">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/partner" className="text-[#1a1a1a]" aria-label="Veiglede for partnere">
            <span className="inline-flex items-center gap-3">
              <VeigledeLogo size="md" tone="dark" />
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.25em] text-[#1a1a1a]/55 border-l border-black/10 pl-3">
                For partnere
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 md:gap-2 text-sm">
            {inDashboard && user ? (
              <>
                <Link
                  to="/partner/dashboard"
                  className="px-3 py-2 rounded-lg hover:bg-black/5"
                  activeOptions={{ exact: true }}
                  activeProps={{ className: "px-3 py-2 rounded-lg bg-black/5 font-semibold" }}
                >
                  Min kampanje
                </Link>
                <Link
                  to="/partner/dashboard/invoices"
                  className="px-3 py-2 rounded-lg hover:bg-black/5"
                  activeProps={{ className: "px-3 py-2 rounded-lg bg-black/5 font-semibold" }}
                >
                  Fakturaer
                </Link>
                <button
                  type="button"
                  onClick={() => signOut().then(() => (window.location.href = "/partner"))}
                  className="ml-2 px-3 py-2 rounded-lg text-[#1a1a1a]/65 hover:text-[#1a1a1a] hover:bg-black/5"
                >
                  Logg ut
                </button>
              </>
            ) : (
              <Link
                to="/partner/register"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
              >
                Registrer bedrift
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
