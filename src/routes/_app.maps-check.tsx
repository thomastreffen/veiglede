import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, ArrowLeft, RefreshCw, Copy } from "lucide-react";

export const Route = createFileRoute("/_app/maps-check")({
  component: MapsCheckPage,
});

type Status = "idle" | "running" | "ok" | "fail";

interface CheckResult {
  status: Status;
  title: string;
  detail?: string;
  hint?: string;
  raw?: string;
}

const INITIAL: CheckResult = { status: "idle", title: "Ikke kjørt" };

function MapsCheckPage() {
  const [browserCheck, setBrowserCheck] = useState<CheckResult>(INITIAL);
  const [serverCheck, setServerCheck] = useState<CheckResult>(INITIAL);
  const [origin, setOrigin] = useState("");

  const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const runBrowserCheck = async () => {
    setBrowserCheck({ status: "running", title: "Tester browser-nøkkel..." });
    if (!browserKey) {
      setBrowserCheck({
        status: "fail",
        title: "Mangler browser-nøkkel",
        detail: "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY er ikke satt. Koble Google Maps Platform i Connectors.",
      });
      return;
    }
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": browserKey,
        },
        body: JSON.stringify({ input: "Oslo", languageCode: "no", regionCode: "NO" }),
      });
      const text = await res.text();
      let data: { error?: { message?: string; status?: string; details?: unknown[] }; suggestions?: unknown[] } = {};
      try { data = JSON.parse(text); } catch { /* keep raw */ }

      if (res.ok && Array.isArray(data.suggestions)) {
        setBrowserCheck({
          status: "ok",
          title: "Browser-nøkkel fungerer",
          detail: `Fikk ${data.suggestions.length} forslag for "Oslo" fra dette domenet (${window.location.host}).`,
        });
        return;
      }

      const message = data.error?.message ?? text.slice(0, 300);
      const status = data.error?.status ?? `HTTP ${res.status}`;
      const isReferrer = /referer|referrer|API key not authorized|requests from this/i.test(message);
      const isKeyInvalid = /API key not valid|API_KEY_INVALID|invalid key/i.test(message);
      const isApiDisabled = /SERVICE_DISABLED|has not been used|is disabled/i.test(message);
      const isBilling = /billing/i.test(message);

      let title = "Browser-nøkkel feilet";
      let hint: string | undefined;
      if (isReferrer) {
        title = "Referrer-restriksjon blokkerer dette domenet";
        hint = `Legg til disse i HTTP referrer allowlist for API-nøkkelen i Google Cloud Console:\n  • https://${window.location.host}/*\n  • https://*.${window.location.host.replace(/^www\./, "")}/*`;
      } else if (isKeyInvalid) {
        title = "API-nøkkelen er ugyldig";
        hint = "Sjekk at nøkkelen er kopiert korrekt og at den ikke er slettet i Google Cloud Console.";
      } else if (isApiDisabled) {
        title = "Places API (New) er ikke aktivert";
        hint = "Google Cloud Console → APIs & Services → Library → aktivér 'Places API (New)' for prosjektet nøkkelen tilhører.";
      } else if (isBilling) {
        title = "Fakturering må aktiveres";
        hint = "Google Cloud-prosjektet trenger fakturering (Billing) påslått — selv for gratis $200 / mnd-bruk.";
      }

      setBrowserCheck({ status: "fail", title, detail: `${status}: ${message}`, hint, raw: text });
    } catch (err) {
      setBrowserCheck({
        status: "fail",
        title: "Klarte ikke kontakte Google",
        detail: (err as Error)?.message ?? String(err),
        hint: "Nettverksfeil eller CORS-blokkering. Sjekk at du har internett og at adblock ikke blokkerer Google.",
      });
    }
  };

  const runServerCheck = async () => {
    setServerCheck({ status: "running", title: "Tester server-proxy..." });
    try {
      const url = new URL("/api/public/google-places", window.location.origin);
      url.searchParams.set("action", "autocomplete");
      url.searchParams.set("input", "oslo");
      url.searchParams.set("_t", String(Date.now()));

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const data = (await res.json()) as { results?: unknown[]; warning?: string; detail?: string; error?: string };
      if (res.ok && Array.isArray(data.results) && data.results.length > 0 && !data.warning) {
        setServerCheck({
          status: "ok",
          title: "Server-proxy fungerer",
          detail: `Gateway returnerte ${data.results.length} forslag for "oslo".`,
        });
        return;
      }
      const msg = data.warning ?? data.error ?? `HTTP ${res.status}`;
      setServerCheck({
        status: "fail",
        title: "Server-proxy feilet",
        detail: msg,
        hint: data.detail ?? "Sjekk at Google Maps Platform-connectoren er koblet til prosjektet.",
        raw: JSON.stringify(data, null, 2),
      });
    } catch (err) {
      setServerCheck({
        status: "fail",
        title: "Klarte ikke kontakte server",
        detail: (err as Error)?.message ?? String(err),
      });
    }
  };

  const runAll = () => { runBrowserCheck(); runServerCheck(); };

  useEffect(() => { runAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <header className="space-y-2">
        <Link to="/settings" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Tilbake til innstillinger
        </Link>
        <h1 className="font-display text-3xl uppercase">Google Places — diagnose</h1>
        <p className="text-sm text-muted-foreground">
          Sjekker om API-nøkkelen din fungerer fra dette domenet og fra serveren.
        </p>
        <p className="text-xs text-muted-foreground">
          Aktivt domene: <span className="font-mono">{origin || "—"}</span>
        </p>
      </header>

      <ResultCard
        title="1. Browser-nøkkel (referrer-restriksjoner)"
        subtitle="Tester en direkte Places API-forespørsel fra denne nettleseren. Dette avslører feil i HTTP referrer-allowlist."
        result={browserCheck}
        onRetry={runBrowserCheck}
      />

      <ResultCard
        title="2. Server-proxy (gateway)"
        subtitle="Tester /api/public/google-places via Lovable-gateway. Bruker server-nøkkelen — referrer-restriksjoner gjelder ikke her."
        result={serverCheck}
        onRetry={runServerCheck}
      />

      <button
        onClick={runAll}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" /> Kjør begge sjekkene på nytt
      </button>

      <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
        <h2 className="font-display text-lg uppercase">Slik fikser du referrer-feil</h2>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Åpne <span className="font-mono">Google Cloud Console → APIs &amp; Services → Credentials</span>.</li>
          <li>Klikk API-nøkkelen som er koblet i Lovable.</li>
          <li>Under <strong>Application restrictions</strong> → <strong>HTTP referrers</strong>, legg til begge:</li>
        </ol>
        <div className="rounded-lg bg-background border border-border p-3 font-mono text-xs space-y-1">
          <CopyableLine value={`${originPattern(origin)}/*`} />
          <CopyableLine value={`${wildcardPattern(origin)}/*`} />
        </div>
        <p className="text-xs text-muted-foreground">
          Endringer kan ta opptil 5 minutter før de slår inn hos Google. Kjør sjekken på nytt etterpå.
        </p>
      </section>
    </div>
  );
}

function originPattern(origin: string): string {
  return origin || "https://veiglede.no";
}

function wildcardPattern(origin: string): string {
  try {
    const u = new URL(origin || "https://veiglede.no");
    const host = u.host.replace(/^www\./, "");
    return `${u.protocol}//*.${host}`;
  } catch {
    return "https://*.veiglede.no";
  }
}

function CopyableLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-surface-2 text-left"
    >
      <span className="truncate">{value}</span>
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
        {copied ? "Kopiert" : <><Copy className="h-3 w-3" /> Kopier</>}
      </span>
    </button>
  );
}

function ResultCard({ title, subtitle, result, onRetry }: {
  title: string; subtitle: string; result: CheckResult; onRetry: () => void;
}) {
  const tone =
    result.status === "ok" ? "border-emerald-500/40 bg-emerald-500/5" :
    result.status === "fail" ? "border-destructive/40 bg-destructive/5" :
    "border-border bg-surface";
  return (
    <section className={`rounded-2xl border p-5 space-y-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg uppercase">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button onClick={onRetry} className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Kjør
        </button>
      </div>
      <div className="flex items-start gap-2">
        <StatusIcon status={result.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{result.title}</p>
          {result.detail && <p className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-wrap">{result.detail}</p>}
          {result.hint && (
            <div className="mt-2 rounded-lg border border-border bg-background p-3 text-xs whitespace-pre-wrap">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Slik fikser du det
              </span>
              <p className="mt-1 text-muted-foreground">{result.hint}</p>
            </div>
          )}
          {result.raw && result.status === "fail" && (
            <details className="mt-2">
              <summary className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer">Vis råsvar</summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-background border border-border p-2 text-[10px] font-mono whitespace-pre-wrap break-all">{result.raw}</pre>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "running") return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-0.5 shrink-0" />;
  if (status === "ok") return <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />;
  if (status === "fail") return <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />;
  return <span className="h-5 w-5 rounded-full border border-dashed border-border mt-0.5 shrink-0" />;
}
