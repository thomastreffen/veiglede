
## Context

The project already has overlapping share infrastructure I'll build on rather than duplicate:
- `ShareTripModal.tsx` — existing modal triggered by "Del tur" (currently links to `/shared/{tripId}`, has a public/private toggle that is currently UI-only)
- `src/routes/shared.$tripId.tsx` — existing public read-only trip page
- `trip_invites` table + `get_shared_trip` RPC — per-recipient invite tokens (separate concept; will keep untouched)
- Trips are persisted in Supabase as a single `jsonb` blob per user (`trips.data`), so trip-level fields like `shareToken` and `isPublic` are stored inside that blob, not as new SQL columns

Given that, I will treat the spec's `share_token` and `/shared/{share_token}` as the canonical public-share URL, separate from the existing per-recipient invite flow.

## 1. Share trip — token-based public link

**Data model (no new column needed):**
- Add `shareToken?: string` and `isPublic?: boolean` to `Trip` in `src/lib/trips-store.ts`
- New `tripsApi.ensureShareToken(tripId)` generates a UUID if missing and persists
- New `tripsApi.setTripPublic(tripId, value)`
- Both update the local store; cloud-sync already writes the whole `data` jsonb on change

**Modal (`ShareTripModal.tsx`):**
- "Del tur" button on the planner already opens this modal — keep it
- Replace the current `tripLink` (which used `/shared/{tripId}`) with `/shared/{shareToken}`
- Wire the existing "Offentlig tur" `Switch` to `trip.isPublic` (real, not local state)
- Auto-generate the token on first open of the modal
- Keep "Kopier lenke" and add an "Åpne Roadbook" link button (using the same token URL + `?view=roadbook`)
- Leave invite/companions section as-is

**New public route `src/routes/shared.$shareToken.tsx`:**
- Resolves trip by `shareToken` from a new server fn `getPublicTripByToken` (uses `supabaseAdmin` to scan trips jsonb)
- If trip not found OR `isPublic !== true` → show "Denne turen er privat" empty state
- Render trip title, origin→destination, map, day-by-day stops, practical info — read-only (reuse the structure from the existing `shared.$tripId.tsx`)
- Bottom CTA "Planlegg en lignende tur" → `/trips/new`
- Veiglede logo in header (already in existing shared page)
- Existing `shared.$tripId.tsx` stays for backward compatibility

**Server fn** `src/lib/public-trips.functions.ts`:
- `getPublicTripByToken({ token })` uses `supabaseAdmin` to find the trip in any user's `trips.data.trips[]` where `shareToken === token`. Returns trip + days + stops + photos, or `{ private: true }` if the token matches but `isPublic` is false.

## 2. Photos per stop

**Supabase Storage:**
- Create `trip-photos` bucket (public read), via migration
- Path convention: `{userId}/{tripId}/{stopId}/{uuid}.{ext}`
- RLS on `storage.objects`:
  - Public SELECT (so shared page renders thumbs)
  - Authenticated INSERT/DELETE limited to `(storage.foldername(name))[1] = auth.uid()::text`

**Data model:**
- Add `photos?: { id: string; url: string; path: string }[]` to `Stop`
- New `tripsApi.addStopPhoto(stopId, photo)` / `removeStopPhoto(stopId, photoId)` (max 5 enforced in API)

**UI in trip planner (`_app.trips.$tripId.tsx`):**
- Each stop row in the day-by-day list gets:
  - Small camera icon button "Legg til bilde" (hidden when 5 photos reached)
  - Thumbnail strip of existing photos below the row
  - Click thumb → fullscreen lightbox (simple Dialog)
- File input `accept="image/*"`, uploads to `trip-photos` via `supabase.storage.from(...).upload(...)`
- After upload, get public URL, call `addStopPhoto`
- "Bilder fra ruta" section (`TripMemories` component) automatically reflects new photos since it reads from the same store

## Technical notes

- Files I'll touch:
  - `src/lib/trips-store.ts` — add fields + api methods
  - `src/components/ShareTripModal.tsx` — wire to real shareToken/isPublic
  - `src/routes/_app.trips.$tripId.tsx` — photo upload UI per stop + lightbox
  - `src/components/TripMemories.tsx` — read stop.photos if present
  - `src/routes/shared.$shareToken.tsx` — new public route (token-based)
  - `src/lib/public-trips.functions.ts` — new server fn
  - `src/start.ts` — verify `attachSupabaseAuth` already wired (no-op if so)
- One SQL migration for the `trip-photos` storage bucket + policies
- No changes to routing config, map rendering, or trip planner layout beyond the additions above
- The existing `shared.$tripId.tsx` and `trip_invites` flow remain untouched

## Confirm before I build

1. OK to keep `shareToken` and `isPublic` inside the existing `trips.data` jsonb (no new SQL column needed)? The spec said "column: share_token" but the schema stores trips as jsonb blobs.
2. OK to keep the existing `/shared/{tripId}` route alongside the new `/shared/{shareToken}` route? Or should the old one be removed?
