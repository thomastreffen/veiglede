import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { isLocale, languageFromCountry, languageFromTag, type Locale } from "@/i18n";

/**
 * Detect a preferred language for an unauthenticated first-time visitor.
 * Priority: CF-IPCountry header > Accept-Language > "en".
 * Returns the detected locale plus the signal that produced it so the UI
 * can decide whether to show the suggestion banner.
 */
export const detectUserLanguageFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locale: Locale; source: "geo" | "header" | "default"; country: string | null }> => {
    const country = (getRequestHeader("CF-IPCountry") ?? getRequestHeader("cf-ipcountry") ?? null) || null;
    const fromCountry = languageFromCountry(country);
    if (fromCountry && isLocale(fromCountry)) {
      return { locale: fromCountry, source: "geo", country };
    }

    const acceptLanguage =
      getRequestHeader("accept-language") ?? getRequestHeader("Accept-Language") ?? "";
    // Accept-Language: "nl-NL,nl;q=0.9,en;q=0.7" — try each tag in order.
    const tags = acceptLanguage
      .split(",")
      .map((p) => p.split(";")[0]?.trim())
      .filter(Boolean) as string[];
    for (const tag of tags) {
      const fromTag = languageFromTag(tag);
      if (fromTag) return { locale: fromTag, source: "header", country };
    }

    return { locale: "en", source: "default", country };
  },
);
