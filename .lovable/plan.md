# Web inspiration + real suggested trips

A large effort. I'll deliver it in clean, shippable phases. Each phase is independently useful and stops short of native app, chat, or "nearby users" work.

## Phase 1 — Real suggested trip objects (foundation)

Add a curated trips data source so seed content behaves like real public trips.

- New file `src/lib/curated-trips.ts` — typed catalogue (id, slug, title, region, country, vehicleSuitability[], style, distanceKm, drivingTime, stopsCount, shortDescription, whyDrive, cover, mapPreview, geometry?, suggestedStops[], source: `'curated' | 'ai' | 'user'`).
- Seed 7 real Norwegian routes: Lofoten rundt, Atlanterhavsveien, Hardanger rundt, Sognefjellet, Drammen–Rødberg–Gaustatoppen, Fin runde fra Drammen, Sognefjellet til Drammen.
- New route `src/routes/inspirasjon.$slug.tsx` — public roadbook-style page for a curated trip (works logged-out). Renders hero, why drive it, suggested stops, map preview, social signals strip, and CTAs.
- Reusable `CuratedTripPage` component (mirrors `SharedTripPage` styling) with CTAs:
  - "Se roadbook" (jumps to stops section)
  - "Vil kjøre denne" (uses curated trip id as reaction target; reuses `toggleReactionFn` with `tripId = "curated:<slug>"`)
  - "Kopier til mine turer" (auth-gated, server fn that materializes curated trip into the user's trips blob)
  - "Tilpass ruten" (sends to new trip wizard prefilled)
- New server fn `copyCuratedTripFn` in `src/lib/curated-trips.functions.ts` that writes a real trip+days+stops into the caller's `trips` blob.

## Phase 2 — Landing page hooks into real curated trips

- Replace static `POPULAR_ROUTES` cards on `src/routes/index.tsx` with curated trip summaries linking to `/inspirasjon/$slug`.
- Each card shows distance, time, style, vehicle suitability, and a small "X vil kjøre" chip (bulk fetched via existing `getTripSocialStatsFn` keyed by curated id).

## Phase 3 — Desktop-first Utforsk layout

Rework `src/routes/_app.explore.tsx`:

- Below `md`: keep current card-first mobile layout.
- At `lg+`: split layout
  ```text
  [ filters/search (col-3) | trip cards list (col-4) | selected preview + details (col-5) ]
  ```
- Map preview area uses existing `MapPreview` for the selected trip.
- New `ExploreFilters` component (region, country, vehicle, style, distance, duration, sort).
- Merge curated + user-public trips into one list (curated trips always available, no empty-state).

## Phase 4 — Filters & sorts

Extend `validateSearch` schema with: `country`, `region`, `vehicle`, `style`, `minKm`, `maxKm`, `sort` (newest | popular | drive | saved). Filters applied client-side over merged list (curated + public). Sort `popular` uses social stats already fetched.

Filter chips: Norge, Sverige, Danmark, Tyskland · MC, Amcar, Veteranbil, Bobil, Elbil · Svingete vei, Rolig cruise, Fototur, Kaffestopp, Nasjonale turistveier, Fjellovergang, Kystvei. Stored as enums in `curated-trips.ts` so future user trips can adopt the same vocabulary.

## Phase 5 — Location-based suggestions (light)

- New `RegionPicker` (city/region/country dropdown, saved to `localStorage`, no geolocation prompt).
- Optional one-tap "Bruk min posisjon" with explicit consent — used only to sort curated trips by distance to first stop. No location ever leaves the client.

## Phase 6 — Social intent: "Åpen for turfølge"

- Add reaction-adjacent intent flag without new tables: extend `trip_reactions.reaction` enum with `convoy` (= "åpen for å kjøre med andre"). Migration + Zod enum bump.
- On `WillDriveButton`: after "Vil kjøre" is active, show secondary checkbox "Åpen for å kjøre med andre" that toggles `convoy`.
- Show "N åpen for turfølge" chip on trip cards/pages.
- No chat, no groups, no nearby-users matching now. Data model only.

## Phase 7 — Public route page polish

Promote `SharedTripPage` + new `CuratedTripPage` to the "engagement hub" shape: hero, why-drive, vehicle/style badges, stops, map, creator card, social action bar (already built), "X vil kjøre / Y åpen for turfølge / Z lagret" strip.

## Phase 8 — Out of scope (explicit)

- Native app, push, background location.
- Chat, DMs, groups, "nearby users" matching.
- Removing or changing existing trip creation flow.
- Mobile redesign — mobile stays card-first.

## Technical notes

- Curated trips use stable ids prefixed `curated:<slug>` so existing `trip_reactions` / `saved_trips` tables work with no schema change (besides the `convoy` enum value).
- One migration: `ALTER TABLE trip_reactions ... CHECK (reaction IN ('fire','road','pin','coffee','drive','convoy'))`.
- One new server fn (`copyCuratedTripFn`), one new route, one new lib module, two new components (`CuratedTripPage`, `ExploreFilters`), edits to `index.tsx`, `_app.explore.tsx`, `WillDriveButton`, `social.functions.ts`, `PublicTripCard`.
- Roughly 8–10 file changes plus the curated catalogue.

Approve and I'll ship phases 1–4 first (real curated trips + landing wiring + desktop explore layout + filters), then 5–7 in a follow-up so each step is reviewable.
