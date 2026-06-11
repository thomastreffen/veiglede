---
name: Product direction — web + native split
description: Strategic split between Veiglede web (planning/social) and native app (active trip/live tracking). Guides all future architecture decisions.
type: feature
---

# Veiglede product model

Two surfaces, one backend (Lovable Cloud / Supabase).

## Web app — "Planlegg og del turen"
Primary use: planning, sharing, discovery, monetization, SEO.
- Trip planning + roadbook editing
- Public shared trips, explore/social discovery
- Profile, garage, partner benefits
- Public share pages, copy-trip
- Auth + onboarding

Web live-sharing keeps working but is explicitly **best-effort**. Locked-phone / background limits are a browser platform limitation — do NOT keep trying to make the web behave like a native nav app.

## Native app (Phase 2) — "På tur"
Primary use: active driving, live tracking, on-the-fly changes.
- Start/stop active trip
- Live sharing with reliable background location
- Update route from current position
- Push notifications
- Quick access to active trips, basic roadbook view
- Social/live engagement while traveling

## Engineering rules going forward
- Keep the new `LiveBroadcaster` abstraction (`src/lib/live/`). All live logic must go through it.
- New live/tracking logic must be platform-agnostic: no `navigator.geolocation` or `document.visibilityState` outside `web-broadcaster.ts`.
- Use `getPlatform()` / `useIsNative()` from `src/lib/platform.ts` for any platform branch.
- Server functions and Supabase models are shared — do not fork schemas per platform.
- Avoid web-only assumptions (no `window`, `localStorage`, `document` in shared libs without guards).

## Phase 2 MVP scope (when explicitly approved)
Capacitor wrapper around existing React app, plus:
1. Login (reuse Supabase auth)
2. List my trips
3. Open active trip
4. Start/stop live sharing
5. Native background location → `NativeLiveBroadcaster`
6. Copy/share live link
7. Basic roadbook view
8. Push notification foundation (later)

Not in MVP: full planning wizard, explore feed, partner benefits dashboard, admin.
