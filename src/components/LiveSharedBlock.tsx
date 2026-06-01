import { useState } from "react";
import { Radio } from "lucide-react";
import { LiveTripMap } from "@/components/LiveTripMap";
import { useLiveSession, isLiveActive } from "@/lib/live-tracking";

export function LiveSharedBlock({ tripId }: { tripId: string }) {
  const session = useLiveSession(tripId);
  const live = isLiveActive(session);
  const [open, setOpen] = useState(false);
  if (!live) return null;
  return (
    <section className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" /> Live
          </span>
          <p className="text-xs text-foreground/80">
            Føreren deler posisjon akkurat nå
            {session?.last_stop_name ? <> · sist: <span className="text-foreground">{session.last_stop_name}</span></> : null}
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
        >
          <Radio className="h-3 w-3 animate-pulse" /> {open ? "Skjul kart" : "Følg live"}
        </button>
      </div>
      {open && <div className="mt-4"><LiveTripMap tripId={tripId} height="50vh" /></div>}
    </section>
  );
}
