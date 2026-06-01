import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/restore/$token")({
  head: () => ({ meta: [{ title: "Gjenopprett konto — Veiglede" }] }),
  component: RestorePage,
});

function RestorePage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"working" | "ok" | "expired" | "deleted" | "invalid" | "error">("working");

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc("restore_account_by_token" as never, { p_token: token } as never);
        if (error) return setState("error");
        const j = (data ?? {}) as { ok?: boolean; reason?: string };
        if (j.ok) {
          setState("ok");
          setTimeout(() => { window.location.assign("/trips"); }, 3000);
        } else if (j.reason === "expired") setState("expired");
        else if (j.reason === "already_deleted") setState("deleted");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-7 text-center">
        <p className="font-display text-2xl uppercase tracking-wide">Veiglede</p>
        <div className="mt-6 text-sm leading-relaxed">
          {state === "working" && <p className="text-muted-foreground">Gjenoppretter kontoen…</p>}
          {state === "ok" && (
            <>
              <p className="text-foreground font-semibold">Velkommen tilbake! 🎉</p>
              <p className="mt-1 text-muted-foreground">Din konto er gjenopprettet. Sender deg videre…</p>
            </>
          )}
          {(state === "expired" || state === "deleted") && (
            <>
              <p>Denne lenken er ikke lenger gyldig. Kontoen din er slettet.</p>
              <Link to="/signup" className="mt-4 inline-block text-primary underline">
                Opprett ny konto
              </Link>
            </>
          )}
          {state === "invalid" && <p>Lenken er ugyldig.</p>}
          {state === "error" && <p>Noe gikk galt. Prøv igjen senere.</p>}
        </div>
      </div>
    </div>
  );
}
