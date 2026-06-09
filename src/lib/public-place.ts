/**
 * Strip a full street address down to a city/region label safe to show
 * publicly (Explore feed, shared trip pages, "Bli med"-cards, og:title/og:description, etc.).
 *
 * Private contexts (the trip owner's own planner, wizard, roadbook) should
 * keep using the raw `origin`/`destination` strings.
 */
export function publicPlaceName(fullAddress: string | undefined | null): string {
  if (!fullAddress) return "";
  const parts = fullAddress.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const withoutCountry = parts.filter((p) => p !== "Norway" && p !== "Norge");
    // Drop a leading street-address part (contains a digit, e.g. "Årkvislaveien 51")
    const trimmed = withoutCountry[0] && /\d/.test(withoutCountry[0])
      ? withoutCountry.slice(1)
      : withoutCountry;
    const pick = trimmed.length > 0 ? trimmed : withoutCountry;
    // Return up to the last 2 meaningful parts (city + region/postal area)
    return pick.slice(-2).join(", ");
  }
  // Single-part input — strip a trailing house number if present.
  const stripped = fullAddress.replace(/\s+\d+[A-Za-z]?$/, "").trim();
  return stripped || fullAddress;
}

/**
 * Privacy-safe display label for public/shared views.
 * Falls back to a broad placeholder when no safe city can be derived.
 */
export function getPublicPlaceLabel(
  input: string | undefined | null,
  fallback: string = "Område",
): string {
  const safe = publicPlaceName(input);
  if (!safe) return fallback;
  // If the result still looks like a street address with a house number, fall back.
  if (/\d+[A-Za-z]?\s*$/.test(safe) && !/,/.test(safe)) return fallback;
  return safe;
}
