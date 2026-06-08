## Goal

Replace the single trip-creation flow at `/trips/new` with a mode selector that branches into:
- **Mode A — "La AI planlegge"**: multi-step wizard that calls Lovable AI to generate a full multi-day itinerary
- **Mode B — "Jeg har stopp klare"**: quick stop-list entry, with optional "Import from text" powered by AI

## File plan

### New files

1. `src/lib/trip-import.functions.ts` — two `createServerFn` endpoints calling Lovable AI Gateway (`google/gemini-3-flash-preview`) via `LOVABLE_API_KEY`:
   - `importTripFromTextFn({ text })` → `{ stops: ImportedStop[] }` using tool calling for structured output.
   - `generateAiTripFn({ from, to, days, startDate, vehicleKind, style, mustVisit, interests, maxHoursPerDay })` → `{ days: [{ dayNumber, date, stops: [{ name, type, durationMin, notes }] }] }`. Used by Mode A step 5.
   - Both validate input with Zod, handle 402/429 with friendly error messages.

2. `src/components/wizard/ModeSelect.tsx` — full-bleed light card layout with the two mode cards (AI vs manual), orange highlight on the AI card, "Begge starter gratis" footnote. Calls `onSelect("ai" | "manual")`.

3. `src/components/wizard/AiWizard.tsx` — 5-step wizard (Grunnleggende, Kjøretøy/stil, Må innom, Interesser, Generer). Reuses `PlaceAutocomplete`, `useVehicles()`, existing style options, and the onboarding interest chips. Provides an "Enkel modus" link that collapses to from/to only and jumps to generate.

4. `src/components/wizard/ManualWizard.tsx` — Mode B. Dynamic list of stop rows (day toggle + `PlaceAutocomplete` + auto-detected type icon + delete), `+ Legg til stopp`, and an `Importer fra tekst` button that opens a sheet with a textarea → calls `importTripFromTextFn` → shows confirmation preview before applying. Step 2 = vehicle + avoid-highway. Step 3 = "Beregn rute".

5. `src/components/wizard/GenerateProgress.tsx` — loading screen with mini-map placeholder + progress steps ("Beregner rute…", "Velger stopp…", "Lager roadbook…").

### Edited files

- `src/routes/_app.trips.new.tsx` — becomes a thin router: shows `ModeSelect` first; once a mode is chosen, mounts `AiWizard` or `ManualWizard`. Keeps existing `createTrip`/route-calculation helpers reused by the new wizard components (extract shared helpers into `src/lib/trip-create.ts` if needed). On success, navigates to `/trips/[id]` and toasts "Din tur er klar! 🎉".
- `src/lib/trips-store.ts` — add helper `createTripFromStops(stops: ImportedStop[], vehicle, opts)` that maps the manual-mode list into the existing `createTrip` shape (origin = first stop, destination = last, intermediate stops inserted, dates respected, lodging auto-detected via existing `looksLikeLodging`).
- `src/i18n/locales/{nb,en,de,nl,sv,da}.ts` — add a new `wizard.modeSelect.*`, `wizard.ai.*`, `wizard.manual.*`, `wizard.import.*`, `wizard.generate.*` namespace covering every visible string.
- `src/i18n/index.ts` — extend the `Dict` type for the new namespace.

### Technical notes

- AI calls go through `https://ai.gateway.lovable.dev/v1/chat/completions` with `tool_choice` forcing a single tool — no JSON-parsing of free text. Surface 402/429 errors as toasts.
- Mode A "Generer" step calls `generateAiTripFn`, then feeds returned stops into the existing `createTrip` + `applyFerrySegments` pipeline so ferry/lodging detection still works.
- Mode B "Beregn rute" calls existing `directions` route then `createTrip` with the manual stop list.
- Reuse `PlaceAutocomplete`, `useVehicles`, existing style chips. No new UI primitives.
- Preserve the existing simple from/to path as "Enkel modus" inside Mode A (state flag that hides intermediate steps).

## Out of scope

- Animated route drawing on the mini map (use a static `MapPreview` + skeleton).
- Changing the trip detail page.
- Editing the existing onboarding interest taxonomy.
