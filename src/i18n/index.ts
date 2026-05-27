// i18n core — language detection, persistence, and a module-level getter
// so non-React code (e.g. trip generation) can read the active language.

import { nb, type Dict } from "./locales/nb";
import { en } from "./locales/en";
import { de } from "./locales/de";

export type Locale = "nb" | "en" | "de";

export const SUPPORTED_LOCALES: Locale[] = ["nb", "en", "de"];

export const DICTIONARIES: Record<Locale, Dict> = { nb, en, de };

const STORAGE_KEY = "veiglede.locale";

/** Read the saved locale from localStorage, if any. */
export function getSavedLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

/** Persist the user's locale choice. */
export function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* no-op */
  }
}

function isLocale(v: unknown): v is Locale {
  return v === "nb" || v === "en" || v === "de";
}

/**
 * Resolve the initial locale:
 * 1. saved preference
 * 2. domain-based default (veiglede.no → Norwegian)
 * 3. browser language
 * 4. fallback (Norwegian on .no, English elsewhere)
 */
export function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "nb";

  const saved = getSavedLocale();
  if (saved) return saved;

  const host = window.location.hostname.toLowerCase();
  const isDotNo = host.endsWith(".no") || host === "veiglede.no";
  const isDotCom = host.endsWith(".com") || host === "veiglede.com";

  // .no defaults to Norwegian regardless of browser
  if (isDotNo) return "nb";

  const browser = (window.navigator.language || "").toLowerCase();

  if (isDotCom) {
    if (browser.startsWith("de")) return "de";
    if (browser.startsWith("nb") || browser.startsWith("no") || browser.startsWith("nn")) return "nb";
    return "en";
  }

  // Generic fallback (preview domains, custom hosts, etc.)
  if (browser.startsWith("nb") || browser.startsWith("no") || browser.startsWith("nn")) return "nb";
  if (browser.startsWith("de")) return "de";
  if (browser.startsWith("en")) return "en";
  return "nb";
}

// --- Module-level getter for non-React consumers (trip generation, etc.) ---

let activeLocale: Locale = "nb";

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

/**
 * Read the currently active UI language from outside React.
 * Use this in trip-generation / AI prompt builders to localize output later.
 */
export function getActiveLocale(): Locale {
  return activeLocale;
}
