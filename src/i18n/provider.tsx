import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  DICTIONARIES,
  detectInitialLocale,
  getSavedLocale,
  saveLocale,
  setActiveLocale,
  type Locale,
} from ".";
import type { Dict } from "./locales/nb";
import { detectUserLanguageFn } from "@/lib/i18n.functions";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
  /** True when the active locale came from geo-IP on this session (banner trigger). */
  geoSuggested: Locale | null;
  dismissGeoSuggestion: () => void;
}

const Ctx = createContext<I18nCtx | null>(null);
const BANNER_DISMISSED_KEY = "veiglede.language-banner-dismissed";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("nb");
  const [geoSuggested, setGeoSuggested] = useState<Locale | null>(null);
  const detect = useServerFn(detectUserLanguageFn);

  // Hydrate from saved preference (or browser fallback) immediately.
  useEffect(() => {
    const initial = detectInitialLocale();
    setLocaleState(initial);
    setActiveLocale(initial);
  }, []);

  // If user has never picked a language, ask the server for geo-IP detection.
  useEffect(() => {
    if (getSavedLocale()) return;
    let cancelled = false;
    detect()
      .then((res) => {
        if (cancelled || !res?.locale) return;
        // Apply it as the active locale (without saving — first manual choice
        // or first navigation will save it).
        setLocaleState(res.locale);
        setActiveLocale(res.locale);
        // Show banner only if geo differs from current and not dismissed.
        try {
          const dismissed = window.localStorage.getItem(BANNER_DISMISSED_KEY);
          if (!dismissed && res.source !== "default") {
            const browserGuess = detectInitialLocale();
            if (res.locale !== browserGuess) setGeoSuggested(res.locale);
          }
        } catch {
          /* no-op */
        }
      })
      .catch(() => {
        /* network error — silently keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [detect]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setActiveLocale(l);
    saveLocale(l);
    setGeoSuggested(null);
  }, []);

  const dismissGeoSuggestion = useCallback(() => {
    setGeoSuggested(null);
    try {
      window.localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    } catch {
      /* no-op */
    }
  }, []);

  const value = useMemo<I18nCtx>(
    () => ({ locale, setLocale, t: DICTIONARIES[locale], geoSuggested, dismissGeoSuggestion }),
    [locale, setLocale, geoSuggested, dismissGeoSuggestion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}

export function useT(): Dict {
  return useI18n().t;
}
