/**
 * Strip a full street address down to a city/region label safe to show
 * publicly (Explore feed, shared trip pages, og:title/og:description, etc.).
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
  return fullAddress;
}
