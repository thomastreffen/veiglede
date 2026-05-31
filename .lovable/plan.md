## Fellestur Step 1 — Reisefølge & delte turer

A sizable feature touching DB schema, a new route, several components, and (optionally) email. Plan first so we agree on shape before I build.

### 1. Database changes (one migration)

Extend the existing `trip_invites` table instead of creating a parallel table — it already has `invite_token`, `status`, `owner_user_id`, `invited_email`, `joined_user_id`. Add:

- `role text NOT NULL DEFAULT 'viewer'` — `viewer` | `editor`
- Index on `invite_token`

Add new `trip_comments` table per spec, with RLS:
- SELECT: trip owner OR accepted member (joined via trip_invites)
- INSERT: same set, only their own `user_id`
- UPDATE/DELETE: only author

Add SECURITY DEFINER RPC `list_followed_trips()` → returns the trip JSON for trips where `auth.uid()` has a `joined` invite (so we can show "Turer jeg følger" without giving anon SELECT on other users' trips).

### 2. Invite flow in `ShareTripModal`

- Replace the optional-email field with **required email + role selector** ("Kan se" | "Kan redigere")
- On submit: create invite row (status = `invited`, role = chosen)
- Send email via Resend connector (server function) — subject + body per spec, link `https://veiglede.no/join/{token}`. If Resend is not connected, fall back to just copying the link and surface a toast "E-post ikke sendt — kopier lenken manuelt"
- Show invite list with status pills: "Venter på svar" / "Godtatt ✓" / "Avslått"

### 3. `src/routes/join.$token.tsx`

- Calls a new `get_invite_preview(token)` RPC (returns trip preview + invite metadata, no PII of other invitees)
- Renders trip card (title, origin→destination, date, distance)
- "Bli med på turen" → if not logged in, store token in localStorage and redirect to `/login`; otherwise call existing `join_trip_with_token` RPC (already exists) and redirect to `/shared/{shareToken}`
- "Avslå" → new RPC `decline_invite(token)` setting status to `revoked`
- Invalid/expired token → friendly message

### 4. "Turer jeg følger" on `/trips`

- Below existing "Mine turer", new section that calls `list_followed_trips()`
- Reuse existing trip card with `👥 Reisefølge` badge instead of owner controls
- Hide delete/edit unless `role = 'editor'`

### 5. Comments on `/shared/{token}` (existing route)

- New `<TripComments tripId>` component shown only when current user is owner or accepted member
- List + 500-char textarea + submit
- Realtime subscription on `trip_comments` filtered by `trip_id`

### 6. Member avatars in trip planner header

- Add `<TripMembers tripId>` next to vehicle badge in `_app.trips.$tripId.tsx`
- Reads accepted invites + owner; renders up to 3 avatars + "+N"
- Click opens `ShareTripModal`

### Technical notes

- Email: prefer **Resend connector** (it's listed in standard connectors and matches the spec wording). I'll ask you to connect it when we get there. If you'd rather use Lovable Emails (built-in, no connector setup), say so.
- No edge functions — all server-side work in TanStack `createServerFn` per stack conventions.
- Existing `trip_invites` and `get_shared_trip` / `join_trip_with_token` RPCs stay; we just extend.

### Open questions

1. **Email provider**: Resend (per spec) or Lovable Emails (zero-config)?
2. **Editor role**: should "Kan redigere" actually let invitees modify stops in this step, or just unlock UI for a later step? (Spec mentions it but doesn't define the edit surface.)

Tell me which way to go on those two and I'll build it end-to-end.
