import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveTripMap } from "@/components/LiveTripMap";
import { VeigledeLogo } from "@/components/VeigledeLogo";
import { useLiveSessionByToken, isLiveActive } from "@/lib/live-tracking";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/live/$token")({
  head: () => ({ meta: [{ title: "Følg live — Veiglede" }] }),
  component: LiveFollowPage,
});


// Strip street/house specifics: prefer the last meaningful comma segment
// (typically city/area), so we never leak a full street address publicly.
function shortenPlace(raw: string): string {
  if (!raw.includes(",")) return raw;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p && !/^\d{3,}$/.test(p)) return p;
  }
  return parts[parts.length - 1] ?? raw;
}

function LiveFollowPage() {
  const { token } = Route.useParams();
  const { session, loading } = useLiveSessionByToken(token);
  // "Ended" is reserved for sessions the driver explicitly stopped
  // (status = "completed"). Anything else — active, paused, or stale —
  // must not be displayed as "Avsluttet" on the public follower page.
  const ended = session?.status === "completed";
  const live = isLiveActive(session);
  const paused = !ended && session?.status === "paused";
  const stale = !!session && !ended && !paused && !live;

  // Fetch the trip's vehicle type once so we can show the matching marker.
  // Safe-by-design RPC: only returns { vehicle_type: 'car' | 'motorcycle' | 'rv' | null }.
  const [vehicle, setVehicle] = useState<string | null>(null);
  useEffect(() => {
    if (!token) { setVehicle(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .rpc("get_live_trip_meta_by_token", { p_token: token });
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        const v = row && typeof row === "object" ? (row as { vehicle_type?: string | null }).vehicle_type : null;
        setVehicle(typeof v === "string" && v.length > 0 ? v : null);
      } catch {
        if (!cancelled) setVehicle(null);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);


  const badge = ended
    ? "Avsluttet"
    : paused
      ? "Pauset"
      : live
        ? "Live"
        : stale
          ? "Stille"
          : "Venter";

  const description = loading
    ? "Henter posisjon…"
    : !session
      ? "Ingen aktiv live-deling for denne lenken. Siden oppdateres automatisk når føreren starter."
      : ended
        ? "Live deling er avsluttet. Du kan trygt lukke denne siden."
        : paused
          ? "Føreren har pauset live-deling. Siden oppdateres automatisk når den starter igjen."
          : stale
            ? "Live-posisjonen oppdateres ikke akkurat nå. Telefonen kan være låst eller uten dekning – siden fortsetter å forsøke."
            : "Posisjonen oppdateres automatisk så lenge føreren deler.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Veiglede" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> <VeigledeLogo size="sm" />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <Radio className={`h-3 w-3 ${live && !paused ? "animate-pulse" : ""}`} />
            Live-deling · {badge}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl uppercase tracking-wide">
          Følger turen live
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-3 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Live-deling.</span> Dette er live-posisjon mens delingen er aktiv. Hele turplanen og kontoopplysninger deles ikke her.
        </p>
        <div className="mt-5">
          <LiveTripMap session={session} vehicle={vehicle} height="420px" />
        </div>
        {session?.last_stop_name && (
          <p className="mt-4 text-xs text-muted-foreground">
            Sist passerte stopp: <span className="text-foreground font-medium">{shortenPlace(session.last_stop_name)}</span>
          </p>
        )}
        <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Du trenger ikke konto for å følge denne turen.
        </p>
      </main>
    </div>
  );
}
