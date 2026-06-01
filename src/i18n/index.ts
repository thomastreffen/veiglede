// i18n core — language detection, persistence, and a module-level getter
// so non-React code (e.g. trip generation) can read the active language.

import { nb, type Dict } from "./locales/nb";
import { en } from "./locales/en";
import { de } from "./locales/de";
import { nl } from "./locales/nl";
import { sv } from "./locales/sv";
import { da } from "./locales/da";

export type Locale = "nb" | "en" | "de" | "nl" | "sv" | "da";

export const SUPPORTED_LOCALES: Locale[] = ["nb", "en", "de", "nl", "sv", "da"];

export const DICTIONARIES: Record<Locale, Dict> = { nb, en, de, nl, sv, da };

export const LOCALE_META: Record<Locale, { flag: string; short: string; long: string }> = {
  nb: { flag: "🇳🇴", short: "NO", long: "Norsk" },
  en: { flag: "🇬🇧", short: "EN", long: "English" },
  de: { flag: "🇩🇪", short: "DE", long: "Deutsch" },
  nl: { flag: "🇳🇱", short: "NL", long: "Nederlands" },
  sv: { flag: "🇸🇪", short: "SV", long: "Svenska" },
  da: { flag: "🇩🇰", short: "DA", long: "Dansk" },
};

const STORAGE_KEY = "veiglede.language";
const LEGACY_STORAGE_KEY = "veiglede.locale";

export function getSavedLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const v =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* no-op */
  }
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (SUPPORTED_LOCALES as string[]).includes(v);
}

/** Map an Accept-Language tag or a country code to a supported locale. */
export function languageFromTag(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (lower.startsWith("nl")) return "nl";
  if (lower.startsWith("de")) return "de";
  if (lower.startsWith("sv")) return "sv";
  if (lower.startsWith("da")) return "da";
  if (lower.startsWith("nb") || lower.startsWith("nn") || lower.startsWith("no")) return "nb";
  if (lower.startsWith("en")) return "en";
  return null;
}

export function languageFromCountry(country: string | null | undefined): Locale | null {
  if (!country) return null;
  const c = country.toUpperCase();
  if (c === "NL" || c === "BE") return "nl";
  if (c === "DE" || c === "AT" || c === "CH") return "de";
  if (c === "SE") return "sv";
  if (c === "DK") return "da";
  if (c === "NO") return "nb";
  if (c === "GB" || c === "US" || c === "IE" || c === "AU" || c === "NZ" || c === "CA") return "en";
  return null;
}

/**
 * Browser-side fallback detection. Use detectUserLanguageFn server fn for
 * geo-IP-based detection on first visit.
 */
export function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "nb";

  const saved = getSavedLocale();
  if (saved) return saved;

  const host = window.location.hostname.toLowerCase();
  if (host.endsWith(".no") || host === "veiglede.no") return "nb";

  const browser = window.navigator.language || "";
  return languageFromTag(browser) ?? "en";
}

// --- Module-level getter for non-React consumers ---

let activeLocale: Locale = "nb";

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getActiveLocale(): Locale {
  return activeLocale;
}
