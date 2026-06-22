import { useEffect, useRef, useState } from "react";

/**
 * UpdatePrompt — detects new Veiglede deployments and offers a one-tap reload.
 *
 * How it works:
 *  - On mount and whenever the app becomes visible/focused, we GET
 *    /api/public/version (no-store). The endpoint returns a buildId that
 *    changes per worker deploy.
 *  - First-ever fetch is stored as the "baseline" — we never prompt on the
 *    very first load (the user just opened the app).
 *  - When a later fetch returns a different buildId, we show a non-blocking
 *    banner: "Ny versjon av Veiglede er klar". Button reloads the page.
 *
 * iOS PWA caveats (documented for future maintainers):
 *  - Manifest fields cached at install time (start_url, id, scope, display,
 *    name, theme/background colors) require the user to remove and re-add
 *    the home-screen icon. Normal JS/CSS/UI fixes do NOT.
 *  - Vite emits hashed filenames for JS/CSS, so the HTML shell is the only
 *    asset that can go stale. Reloading the page is sufficient to pick up
 *    a new shell + new hashed bundles.
 *  - We never clear localStorage, IndexedDB, or Supabase session storage —
 *    auth survives the update.
 */
const POLL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "veiglede.buildId";

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch("/api/public/version", {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { buildId?: string };
    return typeof json.buildId === "string" ? json.buildId : null;
  } catch {
    return null;
  }
}

export function UpdatePrompt() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [reloading, setReloading] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Seed baseline from localStorage so we remember across sessions.
    try {
      baselineRef.current = window.localStorage.getItem(STORAGE_KEY);
    } catch { /* ignore */ }

    let cancelled = false;

    const check = async () => {
      const now = Date.now();
      if (now - lastCheckRef.current < 10_000) return; // debounce
      lastCheckRef.current = now;
      const latest = await fetchBuildId();
      if (cancelled || !latest) return;
      if (!baselineRef.current) {
        baselineRef.current = latest;
        try { window.localStorage.setItem(STORAGE_KEY, latest); } catch { /* ignore */ }
        return;
      }
      if (latest !== baselineRef.current) {
        setHasUpdate(true);
      }
    };

    void check();
    const interval = window.setInterval(check, POLL_MS);
    const onVisibility = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  if (!hasUpdate) return null;

  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    // Best-effort: unregister any legacy service workers and clear their
    // HTTP caches so the next load pulls fresh HTML/JS/CSS.
    // We deliberately do NOT touch localStorage/IndexedDB — auth + trips stay.
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
    } catch { /* ignore */ }
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } catch { /* ignore */ }
    // Persist the new buildId so we don't prompt again immediately.
    const latest = await fetchBuildId();
    if (latest) {
      try { window.localStorage.setItem(STORAGE_KEY, latest); } catch { /* ignore */ }
    }
    // Cache-busting query keeps iOS from serving the stale HTML shell.
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString(36));
    window.location.replace(url.toString());
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-background/95 p-3 pr-2 shadow-2xl backdrop-blur"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Ny versjon av Veiglede er klar</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Last inn på nytt for å hente oppdateringen.</p>
      </div>
      <button
        onClick={handleReload}
        disabled={reloading}
        className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-70"
      >
        {reloading ? "Oppdaterer…" : "Oppdater nå"}
      </button>
    </div>
  );
}
