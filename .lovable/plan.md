# Plan: UX-polish av planleggeren

Omfanget er stort (planner-ruten alene er ~1750 linjer + map + wizard + overview). For å unngå å ødelegge fungerende rute­motor, GPX og wizard deler jeg arbeidet i fire bolker. Hver bolk er en trygg, isolert leveranse — vi kan stoppe etter hver om noe ser feil ut.

## Bolk 1 — Språk + debug-gating (lavest risiko)
- Skjul i normalmodus alt som heter `provider`, `routeWaypointsHash`, `geometry points`, `routeStatus`, `waypoint`, interne ids og rå API-data. Bruk eksisterende `useDebugMode()` fra `DemoDebugPanel`.
- Tekstbytter i alle synlige UI-strenger:
  - "Via-punkt" / "waypoint" → "Legg inn i ruta"
  - "Detour" → "Avstikker"
  - "Ren kjøretid" → "Beregnet kjøretid" (i `TripTimeBudget`)
- Berørte filer: `_app.trips.$tripId.tsx` (debug-panel), `MapLibreTripMap.tsx` (popup-labels), `TripQuickAddSheet.tsx`, `DetourPromptDialog.tsx`, `TripTimeBudget.tsx`, `TripOverview.tsx`.

## Bolk 2 — Hovedhandlingsrad + "Vis i kart"
- Ny komponent `PlannerActionBar` nær toppen av planner-ruten: Stopp · Overnatting · Eksporter · Roadbook · Neste destinasjon (siste mer dempet).
- Bytt eksisterende spredte knapper til denne raden. Eksisterende handlers gjenbrukes — ingen ny logikk.
- Legg til liten "Vis i kart"-knapp på hvert stoppkort (flyTo + åpne popup via eksisterende map-API).
- Berørte filer: `_app.trips.$tripId.tsx`, `TripOverview.tsx`, evt. ny `src/components/planner/PlannerActionBar.tsx`.

## Bolk 3 — Rolig hover + tydelig forslagsvalg
- Fjern hover-effekter på stoppkort/forslag som scroller, flytter kart, åpner popup, eller trigger route controller. Behold kun visuell highlight (Tailwind hover-klasser).
- I forslag-/POI-kort: primærknapp "Legg inn i ruta", sekundærmeny (dropdown) med "Avstikker / Overnatting / Lagre som forslag". Korte hjelpetekster som tooltip.
- Berørte filer: `TripQuickAddSheet.tsx`, `TripOverview.tsx`, `MapLibreTripMap.tsx` (fjerne hover→flyTo hvis det finnes).

## Bolk 4 — Eksportpanel + opphold-tekst
- Nytt `ExportPanel` (i en Dialog/Sheet) med tre kort: Åpne i Google Maps, Eksporter GPX, Del Roadbook. Hver med kort hjelpetekst som spesifisert. Google Maps-eksport bygger en `https://www.google.com/maps/dir/` URL fra origin → stops → destination; viser advarsel om antall-stopp-grense hvis >9 waypoints. GPX-knappen kaller eksisterende `downloadGpx` (urørt).
- Lodging/flere netter: i `ManualWizard` og `TripOverview`, der mellomdag i dag automatisk merkes "Hviledag", endre default-label til "Opphold i {by}". Legg til liten select på dagen: Opphold med aktiviteter / Hviledag (lagret som `dayType` på `TripDay`, om feltet finnes — ellers bare visuell label uten persist).
- Berørte filer: `_app.trips.$tripId.tsx`, ny `src/components/planner/ExportPanel.tsx`, `ManualWizard.tsx`, `TripOverview.tsx`.

## Utenfor scope nå
- **Punkt 8 (turkostnad)** er allerede implementert i `CostCalculator` og vises i `TripTimeBudget`. Jeg lar den stå urørt med mindre du sier noe annet.
- Ingen endringer i route controller, GPX-bygger, MapLibre-motor, auth, sync, deling.

## Spørsmål før jeg starter
1. Skal jeg kjøre alle 4 bolker i denne turen, eller vil du godkjenne bolk for bolk?
2. "Neste destinasjon" — er dette dagens "legg til neste stopp i ruta", eller en spesifikk eksisterende knapp jeg bør gjenbruke? (Jeg ser ikke en åpenbar match i koden.)
3. `dayType` (Opphold / Hviledag) — ok å persistere på `TripDay` som nytt valgfritt felt, eller skal det bare være visuelt?
