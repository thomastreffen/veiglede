
# Veiglede Social Engagement Layer — Plan

Goal: make public trips feel like enthusiast content (roadbook + vehicle + creator), not generic likes. Built on existing primitives we already have: `trip_reactions`, `saved_trips`, `user_follows`, `profiles`, `vehicles`, and `public-trips.functions.ts`.

## What's already in place (good news)
- `trip_reactions` table + `toggleReactionFn` / `getTripReactionsFn` (currently 3 keys: `fire`, `clap`, `pin`).
- `saved_trips` table + `toggleSaveTripFn` / `listSavedTripIdsFn`.
- `user_follows` + follow stats.
- `SaveTripButton`, `CopyTripButton`, `TripReactionsRow`, `PublicTripCard`, `SharedTripPage`, `tur.delt.$shareToken` route.
- `_app.explore.tsx` discovery page.
- Vehicle data per trip (`trip.vehicle` type string), plus a separate `vehicles` (garage) table with photos.

## Phase 1 — Reactions: expand from 3 → 5 keys
Add two new reaction keys: `road` (🛣️ Fin rute) and `coffee` (☕ Kaffetur). Keep `fire` (🔥 Rå tur), `clap` reframed as nothing? — actually map labels:
- 🔥 `fire` = Rå tur
- 🛣️ `road` = Fin rute (new)
- 📍 `pin` = Bra stopp
- ☕ `coffee` = Kaffetur (new)
- 🏁 `clap` repurposed → rename key to `drive` = Vil kjøre (or keep `clap` as DB value, change label only)

Decision: keep DB enum extensible. Migration: drop CHECK constraint on `trip_reactions.reaction` (if any) or extend enum/text values. Use `text` with CHECK constraint `IN ('fire','road','pin','coffee','drive')`. Migrate old `clap` → `drive` (semantic: clap was "Bra tur", but plan emphasizes "Vil kjøre" as the high-intent action — keep `clap` distinct? Plan only lists 5 reactions and explicitly says "Vil kjøre" is most important). We'll **migrate `clap` → `drive`** so existing data maps to the new "intent" key.

Update `social.functions.ts` Zod enum + `TripReactionCounts` shape, and `TripReactionsRow` labels/emojis.

## Phase 2 — "Vil kjøre denne" primary CTA
"Vil kjøre" already exists as a reaction (`drive`). On the public trip page, surface it as a **big primary CTA button** (not just a chip in the reactions row), with three states:
- Logged out → "Logg inn for å lagre" → /login
- Logged in, not reacted → "🏁 Vil kjøre denne"
- Logged in, reacted → "✓ Lagt til ønskeliste" + counter

Place above the fold next to "Kopier tur". Reuse `toggleReactionFn({reaction:'drive'})`. Add a small reusable `WillDriveButton` component.

## Phase 3 — Vehicle identity on trips
Extend `getPublicTripByToken` to also resolve the creator's vehicle for the trip:
- If trip has `vehicleId` reference → fetch that vehicle from `vehicles` (make/model/year/fuel/photo) **only if vehicle is public/garage is public**.
- Else fall back to `trip.vehicle` (type string + emoji).

Add a `VehicleIdentityCard` component shown on `SharedTripPage`:
"Kjørt med **BMW F900GS Adventure** · Svingete vei" + small photo if available.

Also surface on `PublicTripCard` as a one-liner under owner row when data exists.

Privacy: respect `vehicles.is_public` / `profiles.is_public`. If private, fall back to generic type label.

## Phase 4 — Public trip page polish
Restructure `SharedTripPage` sections in this order:
1. Hero (existing) + style + vehicle badges
2. Quick stats strip (distance, time, stops, region, vehicle type) — already partly there
3. **Social action bar**: `WillDriveButton` (primary), `CopyTripButton` (secondary), reactions row, share button, follow creator chip
4. Vehicle identity card (Phase 3)
5. Roadbook (existing days/stops)
6. **Creator card**: avatar, name, follow button, link to `/u/$username`, mini garage preview (1–2 public vehicles)

## Phase 5 — Explore sorting/filtering
Add search-param-driven sort to `_app.explore.tsx`:
- `sort`: `newest` | `most_saved` | `most_drive` | `most_reactions`
- `vehicle`: filter by trip vehicle type (mc, car, amcar, camper, suv…)
- `style`: filter by route style (svingete, cruise, foto, kaffe, scenic)

Extend `fetchPublicTripsFn` to accept these and aggregate counts via `trip_reactions` / `saved_trips`. Start simple — DB-side counts joined per trip id.

## Phase 6 — Activity signals on cards
Add small chips to `PublicTripCard`:
- "🏁 12 vil kjøre" (drive count)
- "💾 5 lagret" (saves count)
- "🔥 3 reaksjoner" (total reactions)
- "Kjørt med BMW F900GS" (vehicle line)

Driven from one bulk fetch in explore loader (`getTripSocialStatsFn({ tripIds })`), so we don't N+1 on cards.

## Phase 7 — Privacy guards (audit, not new feature)
Audit pass:
- `public-trips.functions.ts`: never include private profile data; check `is_public` flags.
- Vehicle resolution: skip when vehicle/garage is private.
- Live sharing endpoints untouched — `tur.delt.$shareToken` and `live.$token` remain separate.
- Confirm no email/phone/last seen leaks.

## Technical changes
- **Migration**: alter `trip_reactions.reaction` CHECK to include 5 keys; UPDATE existing rows `clap`→`drive`. Add indexes on `(trip_id, reaction)` for count queries.
- **New server fns**: `getTripSocialStatsFn({tripIds})` returning `{drive, save, reactions, vehicleLabel}` per trip. Extend `fetchPublicTripsFn` with sort/filter.
- **New components**: `WillDriveButton`, `VehicleIdentityCard`, `CreatorCard`, `ExploreSortBar`.
- **Updates**: `TripReactionsRow` (5 keys, new labels), `PublicTripCard` (activity chips, vehicle line), `SharedTripPage` (new sections + ordering), `_app.explore.tsx` (sort/filter UI + server-side sorting).

## What we explicitly skip (per spec)
- Comments / threads
- Messaging / groups / clubs
- Full activity feed beyond existing followed feed
- Algorithmic ranking beyond simple counts
- New notifications

## Suggested implementation order
1. Migration + reactions enum update (Phase 1)
2. `WillDriveButton` + place on `SharedTripPage` (Phase 2)
3. Vehicle resolver + `VehicleIdentityCard` (Phase 3)
4. `SharedTripPage` restructure + `CreatorCard` (Phase 4)
5. Social stats fn + card chips (Phase 6 — pulled forward, helps explore too)
6. Explore sort/filter (Phase 5)
7. Privacy audit (Phase 7)

Roughly 1 migration + ~3 new components + ~2 server fn additions + updates to 4 existing files.
