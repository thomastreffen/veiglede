# Project Memory

## Core
Two surfaces: Web = planning/social/SEO. Native (Phase 2) = active trip/live tracking. Do not try to make web behave like a native nav app.
All live tracking goes through `src/lib/live/` LiveBroadcaster abstraction. No raw geolocation/visibility outside `web-broadcaster.ts`.
Shared libs must be platform-agnostic (guard `window`/`document`/`localStorage`). Use `src/lib/platform.ts` for branches.

## Memories
- [Product direction](mem://product-direction) — Web vs native split, Phase 2 MVP scope, engineering rules
