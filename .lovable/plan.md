## Goal
Make Veiglede feel like a proper web product on desktop without disturbing mobile. The work is layout-only — no feature, copy, or visual-style changes beyond container widths and column structure.

## Root cause
`AppShell.tsx` wraps every page's `<main>` in `mx-auto max-w-5xl` (1024 px). Every page inherits that cap, so even pages that opt into wider grids get clipped. Header and footer share the same cap. Most route files then add another `max-w-2xl`/`max-w-3xl` inside, narrowing things further.

## Approach
Introduce a small layout primitive and one shell change. Then opt pages into the right width — no global visual redesign.

### 1. Layout primitive (`src/components/layout/PageContainer.tsx`)
A single component with a `width` prop. Mobile is unchanged (full-bleed inside the existing px padding); desktop picks a max-width.

```text
width="narrow"      max-w-3xl     reading/forms (settings sub-pages, legal, auth)
width="content"     max-w-5xl     current default — list pages, simple content
width="wide"        max-w-7xl     dashboards, explore, trip detail, profile
width="full"        no max-w      planner/map workspaces
```

All variants keep `mx-auto w-full px-4 md:px-6`.

### 2. AppShell change
- Remove the `max-w-5xl` cap from `<main>`; keep it on header/footer only (header stays comfortable, footer stays readable).
- `<main>` becomes `flex-1 w-full pb-[...] md:pb-12 pt-2` with no horizontal padding — each page owns its container via `PageContainer`.
- Header inner wrapper widens to `max-w-7xl` so nav doesn't feel cramped on 1440 px+.

This is the single change that unblocks every page; pages that don't get touched in this pass still render at the old width by wrapping their existing content in `<PageContainer width="content">`.

### 3. Per-page opt-ins (this pass)

**Home (`_app.home.tsx`)** — `width="wide"`
- `lg:grid-cols-12` shell
- Hero spans 12; "Fortsett reisen" promotes from 1-col → `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- "Populært i Veiglede" / curated → `lg:grid-cols-3 xl:grid-cols-4`
- "Fra folk du følger" (col-span-8) + "Din garasje" (col-span-4) side-by-side at `lg`
- "Forslag for [vehicle]" → horizontal scroll on mobile, grid at `lg`

**Explore (`_app.explore.tsx`)** — `width="wide"`
- Filter row uses full width
- Region chips full-width row
- Curated grid → `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Public trip grid same breakpoints

**Settings (`_app.settings.tsx`)** — `width="wide"`
- `lg:grid-cols-[280px_minmax(0,1fr)]`
- Left rail: identity card, avatar, public-profile link, account actions, in-page nav
- Right column: existing settings sections stacked

**Garage (`_app.garage.tsx`)** — `width="wide"`
- Vehicle cards → `sm:grid-cols-2 lg:grid-cols-3`

**Trip detail (`_app.trips.$tripId.tsx`)** — `width="wide"`
- Hero/summary spans full width, stats become a horizontal row at `md+`
- Below hero: `lg:grid-cols-[minmax(0,1fr)_360px]` — map + roadbook left, Turkontroll/actions sticky right
- Roadbook keeps its current internal layout

**Trip roadbook (`_app.trips.$tripId.roadbook.tsx`)** — `width="wide"`, two-column at `lg` (day list left, day detail right) using existing components.

**Public/curated trip (`SharedTripPage`, `CuratedTripPage`)** — `width="wide"`
- Wide hero
- `lg:grid-cols-12`: map+roadbook col-span-8, stats/social/creator col-span-4 sticky

**Planner** — already uses `PlannerWorkspace`. Wrap its desktop branch in `width="full"` (no horizontal padding, no max-width) so the `-mx-*` workaround disappears. Mobile branch wraps in `width="content"`.

**Trips list (`_app.trips.tsx`)** — `width="wide"`, trip cards `sm:grid-cols-2 lg:grid-cols-3`.

**Profile (`u.$username.tsx`)** — `width="wide"`, two-column at `lg` (identity/vehicles left, trips right).

**Untouched in this pass** (keep current width via `width="content"` or `"narrow"`): legal pages, auth pages, partner dashboard, admin, fordeler, help. They already read well at current widths.

### 4. Mobile guarantee
Every change is gated on `lg:` (≥1024 px) or larger. Below `lg`, layout is identical to today. `pb-[calc(10rem+env(safe-area-inset-bottom))]` for the bottom nav stays on `<main>`. Bottom nav, FAB, mobile header — all untouched.

## Out of scope
- Visual restyle of cards/colors/typography
- New features or new data fetching
- Reworking individual card components beyond grid placement
- Map workspace behavior (already addressed in the prior task)

## Definition of done
- `max-w-5xl` constraint removed from `<main>`; pages choose their own width.
- Home, Explore, Settings, Garage, Trip detail, Public/curated trip, Trips list, Profile use full desktop width with multi-column layouts at `lg+`.
- Planner desktop branch fills the screen without `-mx-*` hacks.
- Mobile (< `lg`) renders identically to today on every touched page.
- No TypeScript errors.