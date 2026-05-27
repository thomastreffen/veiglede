import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DICTIONARIES,
  detectInitialLocale,
  saveLocale,
  setActiveLocale,
  type Locale,
} from ".";
import type { Dict } from "./locales/nb";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe initial value: always "nb" on the server, then hydrate to the
  // detected locale on the client without a layout flash for first-time
  // visitors on .no (default already matches).
  const [locale, setLocaleState] = useState<Locale>("nb");

  useEffect(() => {
    const initial = detectInitialLocale();
    setLocaleState(initial);
    setActiveLocale(initial);
  }, []);

  // Keep <html lang> in sync for a11y / SEO.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setActiveLocale(l);
    saveLocale(l);
  }, []);

  const value = useMemo<I18nCtx>(
    () => ({ locale, setLocale, t: DICTIONARIES[locale] }),
    [locale, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}

/** Shortcut for the dictionary only. */
export function useT(): Dict {
  return useI18n().t;
}
