import { useEffect, useState } from "react";
import { X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const VISIT_KEY = "veiglede.pwa.visits";
const DISMISS_KEY = "veiglede.pwa.dismissedUntil";
const INSTALLED_KEY = "veiglede.pwa.installed";

let globalDeferredPrompt: BIPEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BIPEvent;
  });
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(globalDeferredPrompt);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.location.search.includes("pwa=reset")) {
      localStorage.removeItem(VISIT_KEY);
      localStorage.removeItem(DISMISS_KEY);
      localStorage.removeItem(INSTALLED_KEY);
    }

    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;

    // Bump visit counter
    const count = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
    localStorage.setItem(VISIT_KEY, String(count));

    // Honor dismissal
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || "0");
    if (Date.now() < dismissed) return;
    if (count < 1) return;

    if (globalDeferredPrompt) {
      setDeferred(globalDeferredPrompt);
      setVisible(true);
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e as BIPEvent;
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setVisible(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari has no beforeinstallprompt — show manual prompt
    if (isIos()) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(Date.now() + sevenDays));
    setVisible(false);
  };

  const install = async () => {
    const prompt = deferred ?? globalDeferredPrompt;
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        globalDeferredPrompt = null;
      }
      setDeferred(null);
      setVisible(false);
    } else if (isIos()) {
      setShowIosHelp(true);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 md:hidden">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Få raskere tilgang
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Legg Veiglede til på hjemskjermen.
            </p>
            {showIosHelp && (
              <p className="mt-2 text-xs text-muted-foreground">
                Trykk på <span className="font-medium">Del</span>-knappen → <span className="font-medium">«Legg til på hjemskjerm»</span>.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Lukk"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm text-foreground"
          >
            Ikke nå
          </button>
          <button
            type="button"
            onClick={install}
            className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Legg til
          </button>
        </div>
      </div>
    </div>
  );
}
