# Alternative ruter og via-punkter

Mål: brukeren skal kunne velge mellom 2–3 naturlige veivalg per dagsetappe (à la Google Maps), og kunne påvirke ruta med via-punkter uten å rote til stoppliste/dagsplan. Valget skal være stabilt etter reload.

## Anbefalt teknisk løsning

Google Routes API (som allerede brukes som primær provider i `src/routes/api/public/directions.ts`) støtter `computeAlternativeRoutes: true` og returnerer inntil 3 ruter med polyline, distanse, varighet og `routeLabels` (`DEFAULT_ROUTE`, `DEFAULT_ROUTE_ALTERNATE`, `FUEL_EFFICIENT`). Vi bygger funksjonen rundt dette i stedet for å rulle vår egen "naturlige via-punkter"-katalog — det er provider-arbeid.

Når Google ikke returnerer alternativer (kort avstand, sjeldent tilfelle), genererer vi best-effort kandidat ved å sende én ekstra forespørsel med et hint-via-punkt fra en kuratert liste over større norske knutepunkter mellom kjente korridorer (Hønefoss, Kongsvinger, Otta, Voss, osv.). Dette caches sammen med valget.

## Datamodell

Nye felt på `TripDay` (`src/lib/trips-store.ts`):

```ts
interface TripDay {
  // ... eksisterende felt
  /** Cachede alternative ruter for denne dagsetappen. */
  routeAlternatives?: RouteAlternative[];
  /** Id på valgt rutevariant (peker inn i routeAlternatives). */
  selectedRouteAltId?: string;
  /** Hash av endepunkter+via-punkter alternativene ble beregnet for. Brukes til invalidering. */
  routeAlternativesHash?: string;
  /** Brukerdefinerte via-punkter som styrer ruta uten å vises som stopp. */
  shapingWaypoints?: ShapingWaypoint[];
}

interface RouteAlternative {
  id: string;                  // f.eks. "alt-0"
  label: string;               // "Raskeste", "Via Hønefoss", "Via Oslo/E6"
  description?: string;        // "Mer naturskjønn, mindre motorvei"
  distanceKm: number;
  durationMin: number;
  geometry: { lat: number; lng: number }[];
  isFastest: boolean;
  deltaMinFromFastest: number; // 0 for raskeste, positivt for tregere
  source: "google-alt" | "google-via-hint" | "fallback";
}

interface ShapingWaypoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;              // "Via Hønefoss"
  // Bevisst ingen `type` — disse er IKKE stopp.
}
```

Stop-typene utvides ikke. Skillet mellom destination/stop/accommodation/via blir:
- destination/origin: felt på `Trip`
- stop/attraction/accommodation: `Stop` (eksisterende)
- via/route-shaping: `ShapingWaypoint` på `TripDay` — aldri i `stops`-listen

## Endringer per fil

1. **`src/routes/api/public/directions.ts`**
   - Aksepter `alternatives?: boolean` og `viaHint?: LatLng` i `Body`.
   - Send `computeAlternativeRoutes: true` til Google, utvid `X-Goog-FieldMask` med `routes.routeLabels`, `routes.description`.
   - Returner alle ruter som `{ routes: [...] }` med samme shape som i dag (distanceKm, durationMin, geometry, ferrySegments, label, description) når `alternatives === true`. Behold dagens single-route-respons når `alternatives` er falsy (bakoverkompatibelt).
   - Auto-navngivning på server: utled label fra `routeLabels` + heuristikk (sammenlign geometri-bbox mot kjente korridor-bbox: Oslo, Hønefoss, Gjøvik, Drammen) når Google ikke gir tekst.

2. **`src/lib/routing/index.ts`**
   - Ny `getRouteAlternatives(input)` som kaller endpoint med `alternatives: true` og normaliserer.
   - Behold `getRoute` for koden som bare trenger raskeste.

3. **`src/lib/trips-store.ts`**
   - Nye felt + tre nye api-metoder:
     - `tripsApi.setRouteAlternatives(dayId, alts, hash)` — cacher resultatet.
     - `tripsApi.selectRouteAlternative(dayId, altId)` — setter `selectedRouteAltId`, kopierer alt's `geometry/distanceKm/durationMin` inn på `TripDay.dayRouteGeometry`/`dayDistanceKm`/`dayDrivingTimeMin` slik at varsel, time budget og kart bruker valget umiddelbart.
     - `tripsApi.setShapingWaypoints(dayId, points)` — invaliderer cache (`routeAlternativesHash` settes til "" → neste fetch henter på nytt).
   - `refreshTripDerivedState` summerer per-dag-felt slik at trip-totaler følger valgt rute.

4. **`src/components/map/MapLibreTripMap.tsx`**
   - Ny prop: dagens valgte alternativer (eller hent fra trip-bundle).
   - Tegn ikke-valgte alternativer som tynnere/transparent linje under valgt rute.
   - Klikk på alternativ-linjen velger den (kaller `selectRouteAlternative`).
   - Long-press / Shift-klikk på kartet → kall `setShapingWaypoints(dayId, [...prev, {lat,lng}])`.

5. **`src/routes/_app.trips.$tripId.tsx` (dagsetappevisning)**
   - Ny knapp per dag: "Velg annen vei" → åpner panel med liste over alternativer:
     - Navn, distanse, kjøretid, "+18 min", kort beskrivelse, fargeprikk som matcher kart-linjen.
     - Radio-valg; persister umiddelbart via `selectRouteAlternative`.
     - Egen seksjon "Via-punkter": liste + "Fjern" + hjelpetekst om at de styrer ruta uten å bli stopp.
   - Henter alternativer via TanStack Query `["routeAlts", dayId, hash]` med `staleTime` 1 time; cache + persistert i store er kilde-til-sannhet, query gjør bare fetch når hash endres.

6. **`src/components/TripOverview.tsx` / `src/lib/trip-time.ts`**
   - Allerede klar: leser `dayDrivingTimeMin`/`dayDistanceKm`. Ingen endring trengs — så lenge `selectRouteAlternative` skriver til disse feltene.

## Caching og stabilitet

- `routeAlternativesHash = hash(origin, destination, shapingWaypoints, vehicle, routeStyle)`. Beregnes klientsiden.
- Henter nye alternativer kun når hash endres. Valgt `selectedRouteAltId` består så lenge id-en finnes i den nye lista; hvis ikke (ny vei er borte) faller vi tilbake til raskeste og varsler brukeren én gang via toast.
- Alle felt persisteres gjennom eksisterende `cloud-sync` — `TripDay`-rader synces allerede.

## Ferry/long-leg-konsistens

`selectRouteAlternative` oppdaterer også `Trip.routeGeometry`/`routeDurationMin` ved å konkatenere alle dagers valgte geometri. Det holder kart, ferge-deteksjon (`PlannerActions` long-leg) og kostnadspanel synkronisert på samme datagrunnlag.

## Begrensninger / out-of-scope (kan komme i del 2)

- Full "dra ruten" (re-routing ved drag av polyline) er kompleks — vi støtter "Klikk for via-punkt" i denne iterasjonen.
- Manuell navngivning av alternativer ("Min favorittvei via Eidsvoll") er ikke i v1.
- AI-trips re-genererer fortsatt hele turen — alternativ-valg på AI-trips begrenses til den ene dagen brukeren redigerer.

## Foreslått rekkefølge for implementering

1. Server: utvid `directions.ts` til å returnere alternativer + labels.
2. Datamodell: nye felt på `TripDay` + tre store-metoder.
3. UI: "Velg annen vei"-panel og kart-rendering av alternativer.
4. Via-punkter: klikk-på-kart-flyt + hash-invalidering.
5. QA: bekreft persistens etter reload, riktige tider i budget, ferge-deteksjon på valgt rute.
