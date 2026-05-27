
# Brukerkontoer og lagrede turer i Veiglede

Mål: gjøre Veiglede klar for ekte brukere. App-en skal være gratis. Brukere kan utforske demo uten konto, og bli bedt om å logge inn først når de vil lagre, dele eller komme tilbake.

## 1. Backend (Lovable Cloud)

Aktivér Lovable Cloud (Supabase under panseret). Setter opp:

**Auth-leverandører**
- Email + passord (default)
- Magic link (email OTP)
- Continue with Google (via Lovable-brokeren)
- Continue with Apple (krever at du legger inn Apple Service ID/Team ID/Key seinere — skrur på provider, og UI viser knappen, men selve innloggingen krever Apple Developer-konfig hos deg)

**Tabeller (alle med RLS scopet til `auth.uid()`)**

```text
profiles            id (=auth.users.id), display_name, avatar_url,
                    theme ('dark'|'light'|'system'), onboarded_at, created_at

driver_prefs        user_id PK, max_driving_hours, pause_every_min,
                    driving_flags jsonb, stop_interests text[]

vehicles            id, user_id, name, type, energy, photo_url,
                    default_style, driving_flags jsonb,
                    stop_interests text[], is_default, created_at

trips               id, user_id, title, subtitle, region, origin,
                    destination, start_date, end_date, vehicle_id,
                    vehicle_snapshot jsonb, style, distance_km,
                    driving_time, cover, ai_summary, status
                    ('idle'|'active'|'paused'|'completed'),
                    is_public, share_slug, created_at

trip_days           id, trip_id, day_number, title, date, summary

stops               id, day_id, name, type, location, description,
                    reason, estimated_time, duration_min,
                    distance_from_prev_km, notes, photo_op,
                    promoted, "order"

trip_tracking       trip_id PK, status, visited_stop_ids text[],
                    spontaneous_stops jsonb, started_at, completed_at
```

`vehicle_snapshot` lagrer kjøretøyets navn/type/energi på *opprettelses­tidspunktet*, slik at gamle turer fortsatt viser riktig kjøretøy selv om brukeren senere sletter eller endrer en bil.

**Storage-bucket**: `vehicle-photos` (private, signed URLs) for ekte kjøretøybilder.

## 2. Frontend-arkitektur

**Demo-modus beholdes.** All eksisterende `localStorage`-logikk (`trips-store`, `vehicles-store`, `driver-prefs`, `trip-tracking`) får et tynt repository-lag:

```text
src/lib/repo/
  trips-repo.ts        local | cloud
  vehicles-repo.ts     local | cloud
  prefs-repo.ts        local | cloud
  trip-tracking-repo.ts
```

`useAuth()` (TanStack Router context) avgjør hvilken implementasjon som brukes. Ikke-innloggede brukere kjører som i dag mot localStorage. Innloggede brukere synker mot Cloud via `createServerFn` + `requireSupabaseAuth`.

**Auth-state**
- `src/lib/auth-context.tsx` — wrapper rundt `supabase.auth`, eksponerer `{ user, isAuthenticated, signIn*, signOut }` til router-context.
- Root registrerer `onAuthStateChange` én gang (router.invalidate + queryClient.invalidate).

## 3. Nye sider/komponenter

```text
src/routes/
  login.tsx              Email/passord, Magic link, Google, Apple
  signup.tsx             Samme valg, "opprett konto"
  auth.callback.tsx      OAuth/magic-link redirect handler
  _app/onboarding.tsx    4 steg etter signup
src/components/
  SaveTripPrompt.tsx     Modal "Vil du lagre turen din?"
  AuthButtons.tsx        Google/Apple/Email-knapper
  RequireAuth.tsx        Inline-gate (ikke redirect) for handlinger
```

Eksisterende sider får små endringer:
- **Top nav**: "Logg inn" når utlogget, avatar-meny når innlogget.
- **Planner / Roadbook**: "Lagre tur" / "Del tur" / "Eksport" trigger `SaveTripPrompt` hvis utlogget. Lokale demo-turer migreres automatisk til kontoen etter login.
- **Settings/Profil**: viser konto-info øverst når innlogget; logout-knapp; "Slett konto" som no-op-stub (eller skjult).
- **Trips-listen**: badge "Demo (kun på denne enheten)" når utlogget.

## 4. Onboarding etter signup

Fire korte steg på `/onboarding`:
1. Velkommen til Veiglede
2. Legg til første kjøretøy (gjenbruker `VehicleEditor`)
3. Velg kjørestil (gjenbruker eksisterende sliders/flags)
4. Klar til å planlegge → CTA "Lag første tur"

Hopp-over-knapp på alle steg. `profiles.onboarded_at` settes når ferdig, slik at vi ikke viser det igjen. Hvis brukeren allerede har demo-data lokalt, importeres det her (med bekreftelse).

## 5. Migrasjon av demo-data ved innlogging

Når en utlogget bruker logger inn / registrerer seg:
1. Sjekk om det finnes lokale trips/vehicles/prefs.
2. Vis liten dialog: "Vi fant en demo-tur — vil du lagre den på kontoen din?"
3. Ved ja: bulk-insert via en `migrateDemoData` server-fn, og tøm `localStorage`-nøklene.

## 6. Det vi *ikke* bygger nå

- Betaling, abonnement, business-portal, ads, partner-dashbord, roller/admin.
- Ekte GPS/Bluetooth/CarPlay (forblir konsept som før).
- Sletting av brukerkonto (kun stub-knapp).

## 7. Teknisk rekkefølge

1. Aktiver Lovable Cloud.
2. Migrasjoner: tabellene over + RLS + GRANTs + storage-bucket.
3. `auth-context` + root `onAuthStateChange`.
4. Login/Signup/Callback-sider med Google + Apple (via `supabase--configure_social_auth`) + email + magic link.
5. Repo-lag (lokal vs cloud) bak eksisterende stores, uten å endre kall-stedene.
6. ServerFns: `getMyTrips`, `saveTrip`, `getMyVehicles`, `saveVehicle`, `getPrefs`, `savePrefs`, `migrateDemoData`.
7. `SaveTripPrompt` + integrasjon i Planner/Roadbook.
8. Onboarding-route.
9. Topnav avatar/login-knapp.
10. Test demo→signup→migrasjon→innlogget bruk.

## Spørsmål før jeg starter

1. **Apple-pålogging**: skal jeg skru på provideren nå selv om du må legge inn Apple Service ID/Key i Cloud-innstillingene senere før den faktisk virker? (Knappen vises uansett.)
2. **Auto-migrasjon av demo-data**: skal dialogen være "spør først" (anbefalt) eller automatisk?
3. **Theme-preferanse**: skal den fortsatt være per-enhet (localStorage) eller flyttes til `profiles.theme` slik at den følger brukeren?
