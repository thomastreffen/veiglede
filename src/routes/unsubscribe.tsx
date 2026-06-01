import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Meld av — Veiglede" }] }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return setState("invalid");
        if (j.valid) return setState("valid");
        if (j.reason === "already_unsubscribed") return setState("already");
        setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/email/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.success) setState("done");
      else if (j.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-surface p-7 text-center">
        <p className="font-display text-2xl uppercase tracking-wide">Veiglede</p>
        <div className="mt-6 text-sm">
          {state === "loading" && <p className="text-muted-foreground">Sjekker lenken…</p>}
          {state === "valid" && (
            <>
              <p className="text-foreground">Vil du melde deg av e-poster fra Veiglede?</p>
              <button
                onClick={confirm}
                disabled={busy}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
              >
                {busy ? "Melder av…" : "Bekreft avmelding"}
              </button>
            </>
          )}
          {state === "done" && <p>Du er nå meldt av. 🌿</p>}
          {state === "already" && <p>Du er allerede meldt av.</p>}
          {state === "invalid" && <p>Denne lenken er ikke gyldig.</p>}
          {state === "error" && <p>Noe gikk galt. Prøv igjen senere.</p>}
        </div>
      </div>
    </div>
  );
}
