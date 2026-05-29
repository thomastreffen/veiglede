# "+" Bottom Sheet — Location-Aware Quick Add

Replace the free-text forms in `TripQuickAddSheet` with the same `PlaceAutocomplete` the planner uses, so every added stop carries real `lat`/`lng` and lights up on the map.

## What changes

### Shared
- Import `PlaceAutocomplete` and `ResolvedPlace` from `@/components/PlaceAutocomplete` / `@/lib/places/geocoder`.
- New `Mode` values: `"stop" | "fuel" | "lodging"` (drop the old text-only fuel/lodging forms).
- All three location modes share one small reusable block: search input → selected card → submit button.
- Resolve target day: `firstDay` for stop/fuel, `lastDay` for lodging (current logic).
- After every successful add: toast with the stop name, dispatch `trip-photos:refresh`-style not needed; trip store already triggers re-render → map pin appears automatically.

### 1. 📍 Legg til stopp
- Mode `"stop"`: `PlaceAutocomplete` + placement chooser shown after a place is selected.
- Placement chooser (inline, three full-width buttons — we do NOT call `DetourPromptDialog` directly because it needs `distanceFromRouteKm` etc. that we don't have here; we mimic its three outcomes):
  - **Langs ruta** → `placement: "along"`, `routeStatus: "on-route"`, `type: "attraction"`
  - **Avstikker** → `placement: "detour"`, `routeStatus: "detour"`, `type: "detour"`
  - **Egen dag** → `placement: "new-day"` on `lastDay` (creates a fresh stop on the last day; full new-day creation already lives in `addSuggestionAt` but requires a SuggestedStop — for parity with the existing quick-type buttons we just append to the last day with `placement: "new-day"`)
- All variants call `tripsApi.addStop(targetDay.id, { name, location, lat, lng, placement, routeStatus, type, durationMin: 30 })`.

### 2. ⛽ Legg til drivstoffstopp
- Mode `"fuel"`: `PlaceAutocomplete` (free search; no special POI filter — MapTiler search isn't pre-filterable here without changing the geocoder).
- After selection, show optional "Estimert pris per liter" decimal input.
- Submit → `addStop(firstDay.id, { name, type: "fuel", location, lat, lng, description, durationMin: 10 })`.

### 3. 🏨 Legg til overnatting
- Mode `"lodging"`: `PlaceAutocomplete`.
- After selection: date input (prefilled `trip.startDate`) + nights input (default 1).
- Submit → `addStop(lastDay.id, { name, type: "lodging", location, lat, lng, description: "Overnatting (N netter). Innsjekk DATE.", durationMin: 720 * nights })`.
  - Note: `StopType` has no `"overnight"`; canonical lodging type is `"lodging"` — matches existing `addOvernight` helper.

### 4. 📝 Legg til notat — unchanged.
### 5. 📷 Ta bilde — unchanged (already uses shared `uploadTripPhoto`).

## Files

- `src/components/TripQuickAddSheet.tsx` — full rewrite of the three form modes; menu items, photo handler, note handler unchanged.

## Out of scope

- Route recalculation after adding a via-point. Current planner doesn't recalculate after `addSuggestionAt` either — keeping behavior identical, per "do not change routing logic".
- POI category filtering inside MapTiler — geocoder doesn't expose it; free search is used.
- Desktop layout and main planner search are untouched.

## Technical notes

- `ResolvedPlace.name` → `stop.name`; `ResolvedPlace.secondary` → `stop.location`.
- `lat`/`lng` are top-level optional fields on `Stop` (`trips-store.ts:418-448`).
- When no day exists yet, the action errors out with toast — same guard as today.
- Selected place is stored in component state; "Endre" button clears the selection and reopens the autocomplete.
