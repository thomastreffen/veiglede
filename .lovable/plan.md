## Scope

Six related improvements to the trip planner (`/trips/$tripId`). Touches routing logic, the trip store, the trip detail route, `TripMap`, `TripTimeBudget`/`CostCalculator`, and the print stylesheet. Pure frontend + client logic — no DB schema changes.

## 1. Ferry auto-detection (`src/lib/routing/index.ts` + `src/lib/trips-store.ts`)

- Extend the route fetch helper to inspect Google Routes `legs[].steps[].travelMode === "FERRY"` and return a `ferrySegments[]` array: `{ fromName, toName, durationMin, polylineIndex }`.
- New helper `detectAndInsertFerryStops(trip, ferrySegments)` in `trips-store.ts`:
  - For each segment, insert a stop with `type: "ferry"`, `name: "Ferje: A → B"`, `durationMin`, `emoji: "⛴️"`, `isAutoDetected: true`, `ferryCostNok?: number`.
  - Skip if a ferry stop with same from→to already exists (idempotent).
- Add `type: "ferry"` to the stop union and `isAutoDetected`, `ferryCostNok` fields.
- When `vehicle.type === "rv"` or stop interests include `"ferries"`, pass a `preferFerries` hint into the route request (logged + used as a soft preference; Google Routes doesn't support a hard ferry-preference flag, so we just don't avoid them and surface them prominently).
- Wire detection into the existing "recalculate route" flow inside the trip detail view so newly-added stops trigger detection.

## 2. OVERSIKT tab (`src/routes/_app.trips.$tripId.tsx` + new `src/components/TripOverview.tsx`)

Add a new tab next to DAG FOR DAG / PAKKELISTE. The tab renders `<TripOverview trip={trip} />` with a 3-column responsive layout (stacks on mobile <768px):

```text
[ Day marker 30% ] [ Timeline 40% ] [ Day stats 30% ]
```

- **Left**: day number, date, departure time, 🏨 if lodging, ⛴️ if ferry, day km/time totals.
- **Center**: vertical line with colored dots per stop type (orange start/end, blue lodging, green food/fuel, teal attraction/viewpoint, grey ferry). Stop name + drive time between dots.
- **Right**: km, drive time, est. fuel/charging cost (reuse `CostCalculator` math), departure → arrival range.
- Clicking a dot scrolls to the corresponding stop card in DAG FOR DAG.

### Trip summary card (top of OVERSIKT)
Total days, total km, total drive time, est. total cost (fuel + lodging + ferries), # overnights, # ferries, regions (derived from stop `region` field), vehicle + route style.

## 3. Map improvements (`src/components/TripMap.tsx`)

- Split the route polyline by day boundaries; render each day's polyline in a different shade of orange (HSL lightness ramp).
- Render numbered pin markers (1, 2, 3…) at overnight stops.
- Render ferry segments as dashed polylines (`strokeDashArray`).
- Stop markers dispatch a `trip:scroll-to-stop` custom event with `stopId`; the trip detail page listens and scrolls the matching card into view.

## 4. Per-day cost breakdown (`src/components/TripTimeBudget.tsx` + `CostCalculator.tsx`)

- Replace single total with a table: `Dag | Km | Drivstoff | Overnatting | Ferje | Total`.
- Ferry cost: each ferry stop in DAG FOR DAG gets a small "Billettpris (NOK)" input that writes back to `stop.ferryCostNok`.
- Grand total row.
- "Del kostnad" button toggles per-person view using `costSettings.passengers`.

## 5. Print/PDF stylesheet

- Existing print styles in the trip detail page get a new `@media print` block for the OVERSIKT timeline: rendered as a clean table, `page-break-after: always` per day, ferry rows highlighted with a left border, lodging booking details inline.

## 6. i18n

All new strings added to `nb/en/de/nl/sv/da` under `app.tripDetail.overview.*` and `app.tripDetail.costs.*`.

## Technical notes

- All work is client-side; no migrations.
- Re-uses existing `tripsApi.updateTrip` to persist ferry stops and `ferryCostNok`.
- `TripOverview` is a new component (~300 lines) to keep `_app.trips.$tripId.tsx` from growing further.
- No new packages required.

## Out of scope

- Real ferry schedule API integration (we only link out to `rutebok.no`).
- Server-side PDF rendering (uses existing browser-print flow).
