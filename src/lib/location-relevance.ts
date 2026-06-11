/**
 * Location & locale relevance for curated trips.
 *
 * Privacy: precise geolocation is ONLY obtained on explicit user click.
 * This module never reads navigator.geolocation on its own — it just
 * accepts a {lat, lng} when the caller provides one.
 */

import type { Locale } from "@/i18n";
import type { Country, CuratedTrip, MacroRegion } from "@/lib/curated-trips";
import type { RouteStyle, VehicleType } from "@/lib/trips-store";

/** Country preference order keyed by locale. First entry is the "home" country. */
export const LOCALE_COUNTRY_PRIORITY: Record<Locale, Country[]> = {
  nb: ["no", "se", "dk"],
  sv: ["se", "no", "dk"],
  da: ["dk", "no", "se", "de"],
  de: ["de", "no", "se", "dk"],
  nl: ["de", "dk", "no"],
  en: ["no", "se", "dk", "de"],
};

/** Returns the user's most likely "home" country given the active locale. */
export function homeCountryForLocale(locale: Locale): Country {
  return LOCALE_COUNTRY_PRIORITY[locale]?.[0] ?? "no";
}

/** Returns true if this locale should see a dedicated "Norway roadtrips for visitors" section. */
export function isForeignVisitorLocale(locale: Locale): boolean {
  return locale !== "nb";
}

/** Haversine distance in km between two lat/lng pairs. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Closest distance from a user location to either start or end of a curated trip. */
export function distanceToTrip(
  user: { lat: number; lng: number },
  trip: CuratedTrip,
): number {
  return Math.min(distanceKm(user, trip.originLoc), distanceKm(user, trip.destinationLoc));
}

export interface RelevanceInput {
  locale: Locale;
  /** Explicitly selected country filter, if any. */
  country?: Country | "all";
  /** Explicitly selected macro region, if any. */
  macroRegion?: MacroRegion | "all";
  /** Preferred vehicle (profile or filter). */
  vehicle?: VehicleType | "all";
  /** Preferred route style. */
  style?: RouteStyle | "all";
  /** Precise user location, only set after the user clicks "Show routes near me". */
  userLocation?: { lat: number; lng: number };
  /** Optional social stat lookup. */
  social?: { drive: number; saves: number; reactions: number };
}

/**
 * Curated-trip relevance score. Higher = more relevant.
 * Designed for ranking, not absolute meaning.
 */
export function curatedRelevanceScore(trip: CuratedTrip, input: RelevanceInput): number {
  let score = 0;

  // Locale → country preference
  const order = LOCALE_COUNTRY_PRIORITY[input.locale] ?? ["no"];
  const localeRank = order.indexOf(trip.country);
  if (localeRank === 0) score += 30;
  else if (localeRank === 1) score += 15;
  else if (localeRank > 1) score += 5;

  // Explicit country selection dominates
  if (input.country && input.country !== "all") {
    if (trip.country === input.country) score += 50;
    else score -= 40;
  }

  // Macro-region match
  if (input.macroRegion && input.macroRegion !== "all") {
    if (trip.macroRegions[0] === input.macroRegion && trip.macroRegions[trip.macroRegions.length - 1] === input.macroRegion) {
      score += 40;
    } else if (trip.macroRegions[0] === input.macroRegion) {
      score += 30;
    } else if (trip.macroRegions[trip.macroRegions.length - 1] === input.macroRegion) {
      score += 20;
    } else if (trip.macroRegions.includes(input.macroRegion)) {
      score += 12;
    }
  }

  // Vehicle suitability
  if (input.vehicle && input.vehicle !== "all" && trip.vehicleSuitability.includes(input.vehicle)) {
    score += 10;
  }

  // Style match
  if (input.style && input.style !== "all" && trip.style === input.style) {
    score += 8;
  }

  // Precise user-location proximity
  if (input.userLocation) {
    const d = distanceToTrip(input.userLocation, trip);
    if (d < 50) score += 40;
    else if (d < 150) score += 25;
    else if (d < 300) score += 12;
    else if (d < 600) score += 4;
  }

  // Social stats (small bump)
  if (input.social) {
    score += Math.min(20, input.social.drive * 2 + input.social.saves + input.social.reactions * 0.5);
  }

  return score;
}

/**
 * Bucket trips by user-distance for "near me" sections.
 * Returns groups in km thresholds, each sorted by distance ascending.
 */
export function nearMeBuckets(trips: CuratedTrip[], user: { lat: number; lng: number }) {
  const withDist = trips.map((t) => ({ trip: t, distance: distanceToTrip(user, t) }));
  withDist.sort((a, b) => a.distance - b.distance);
  return {
    within100: withDist.filter((x) => x.distance < 100),
    within250: withDist.filter((x) => x.distance >= 100 && x.distance < 250),
    within500: withDist.filter((x) => x.distance >= 250 && x.distance < 500),
    nearest: withDist.slice(0, 6),
    all: withDist,
  };
}

/** UI labels for the "Show routes near me" CTA per locale. */
export const NEAR_ME_LABELS: Record<Locale, { cta: string; tip: string; loading: string; denied: string; nearYou: string; weekend: (city?: string) => string; within: (h: number) => string; }> = {
  nb: {
    cta: "Vis turer nær meg",
    tip: "Vi bruker posisjonen kun til å foreslå turer nær deg.",
    loading: "Henter posisjon…",
    denied: "Vi fikk ikke posisjonen din. Velg område manuelt under.",
    nearYou: "Turer nær deg",
    weekend: (city) => `Helgeturer${city ? ` fra ${city}` : ""}`,
    within: (h) => `Innen ${h} ${h === 1 ? "time" : "timer"} kjøring`,
  },
  sv: {
    cta: "Visa turer nära mig",
    tip: "Vi använder positionen endast för att föreslå turer nära dig.",
    loading: "Hämtar position…",
    denied: "Vi kunde inte hämta din position. Välj område manuellt nedan.",
    nearYou: "Turer nära dig",
    weekend: (city) => `Helgturer${city ? ` från ${city}` : ""}`,
    within: (h) => `Inom ${h} ${h === 1 ? "timme" : "timmar"} körning`,
  },
  da: {
    cta: "Vis ture nær mig",
    tip: "Vi bruger kun positionen til at foreslå ture nær dig.",
    loading: "Henter position…",
    denied: "Vi kunne ikke hente din position. Vælg område manuelt nedenfor.",
    nearYou: "Ture nær dig",
    weekend: (city) => `Weekendture${city ? ` fra ${city}` : ""}`,
    within: (h) => `Inden for ${h} ${h === 1 ? "time" : "timer"} kørsel`,
  },
  de: {
    cta: "Routen in meiner Nähe anzeigen",
    tip: "Wir verwenden den Standort nur, um Routen in deiner Nähe vorzuschlagen.",
    loading: "Standort wird abgerufen…",
    denied: "Wir konnten deinen Standort nicht abrufen. Wähle die Region unten manuell.",
    nearYou: "Routen in deiner Nähe",
    weekend: (city) => `Wochenendrouten${city ? ` ab ${city}` : ""}`,
    within: (h) => `In ${h} ${h === 1 ? "Stunde" : "Stunden"} Fahrt`,
  },
  nl: {
    cta: "Toon routes bij mij in de buurt",
    tip: "We gebruiken de locatie alleen om routes in de buurt voor te stellen.",
    loading: "Locatie wordt opgehaald…",
    denied: "We konden je locatie niet ophalen. Kies hieronder handmatig een regio.",
    nearYou: "Routes bij jou in de buurt",
    weekend: (city) => `Weekendritten${city ? ` vanaf ${city}` : ""}`,
    within: (h) => `Binnen ${h} ${h === 1 ? "uur" : "uur"} rijden`,
  },
  en: {
    cta: "Show routes near me",
    tip: "We only use your location to suggest nearby routes.",
    loading: "Getting your location…",
    denied: "We couldn't get your location. Pick a region manually below.",
    nearYou: "Routes near you",
    weekend: (city) => `Weekend trips${city ? ` from ${city}` : ""}`,
    within: (h) => `Within ${h} ${h === 1 ? "hour" : "hours"} drive`,
  },
};

/** Foreign-visitor headline per locale (for "Norway roadtrips" section). */
export const FOREIGN_NORWAY_HEADLINE: Record<Locale, string | null> = {
  nb: null,
  sv: "Norska roadtrips värda att planera",
  da: "Norske roadtrips værd at planlægge",
  de: "Norwegen-Roadtrips, die sich lohnen",
  nl: "Noorwegen-roadtrips de moeite waard",
  en: "Norway roadtrips worth planning",
};
