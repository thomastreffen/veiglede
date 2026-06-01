import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

const STORAGE_KEY = "veiglede-cookie-consent-v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // ignore (SSR / privacy mode)
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Informasjonskapsler"
      className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 md:px-5 md:pb-5 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
          <p className="text-sm text-foreground/90 flex-1">
            Veiglede bruker kun nødvendige informasjonskapsler for innlogging og sesjonshåndtering.{" "}
            <Link to="/personvern" className="underline underline-offset-4 hover:text-foreground">
              Les mer
            </Link>
            .
          </p>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <button
              onClick={accept}
              className="inline-flex items-center justify-center rounded-full bg-foreground text-background px-5 py-2 text-sm font-medium hover:opacity-90 transition"
            >
              Godta
            </button>
            <button
              onClick={accept}
              aria-label="Lukk"
              className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
