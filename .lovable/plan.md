# Partner Portal — Implementation Plan

A self-service portal for businesses to register, run advertising campaigns, and see invoices, fully separated from the main app and admin panel.

## 1. Database (single migration)

Three new tables + storage bucket. All scoped to the logged-in partner via RLS; admins can read/write via existing `is_admin()` helper.

- `partner_accounts` — one row per registered business (linked to `auth.users`)
  - `business_name`, `contact_name`, `org_number`, `category` (mat/overnatting/attraksjon/drivstoff/annet), `website`, `logo_url`, `status` (pending/active/suspended), `partner_id` (FK → `partners.id` so we know which public partner row this account owns)
- `partner_campaigns` — campaigns belonging to an account
  - `partner_account_id`, `partner_id`, `name`, `starts_at`, `ends_at`, `budget_nok`, `pricing_model` (cpm/fixed), `cpm_rate` (default 15), `status` (draft/active/paused/completed)
- `partner_invoices` — generated monthly
  - `partner_account_id`, `campaign_id`, `period_start`, `period_end`, `impressions`, `clicks`, `amount_nok`, `status` (unpaid/paid)
- Storage bucket `partner-logos` (public read, authenticated write to own folder)
- RLS: each partner sees/edits only rows where `partner_account_id` belongs to them; admins via `is_admin(auth.uid())`
- pg_cron job on the 1st of each month → calls a public server route that aggregates the previous month's impressions/clicks per active campaign and inserts an unpaid invoice row

## 2. Routes (all outside `_app` / admin layout)

- `partner.tsx` — pathless layout (light theme, slim header with logo + nav when signed in)
- `partner.index.tsx` — split-screen landing + login form
- `partner.register.tsx` — 3-step registration wizard
- `partner.dashboard.tsx` — auth-gated layout (redirects to `/partner` if not signed in or no `partner_account`)
- `partner.dashboard.index.tsx` — month stats + campaign list + "Ny kampanje" CTA
- `partner.dashboard.campaign.new.tsx` — create form
- `partner.dashboard.campaign.$id.tsx` — edit form
- `partner.dashboard.invoices.tsx` — invoice table with print-to-PDF per row
- `api/public/cron/generate-partner-invoices.ts` — server route called by pg_cron

## 3. Server functions (`src/lib/partner.functions.ts`)

- `registerPartnerFn` — creates auth user, `partner_account` (pending), and a `partners` entry with `is_active = false`
- `getMyPartnerAccountFn` — current partner account + linked partner row
- `getMyDashboardFn` — current-month aggregate stats + campaign list
- `upsertCampaignFn` / `setCampaignStatusFn`
- `listMyInvoicesFn`
- Admin: `listPartnerAccountsFn`, `approvePartnerAccountFn`, `suspendPartnerAccountFn`

## 4. Registration flow

Step 1 — business info + auth credentials (creates Supabase user with email/password, no email confirmation needed for the form — confirmation handled by existing auth-email-hook).
Step 2 — website, logo upload (client-side compress to 400×400 via canvas → upload to `partner-logos/<userId>/logo.jpg`), short description.
Step 3 — address via existing `PlaceAutocomplete`, map preview, submit creates everything in one server fn call.

Success screen: "Takk! Vi gjennomgår søknaden din og aktiverer kontoen innen 1–2 virkedager."

## 5. Admin integration (`/admin/annonsører` → existing `admin.advertisers.tsx`)

Replace placeholder with real partner-account list. Per row:
- status pill, business info, registered date
- "Godkjenn" → sets `partner_account.status = 'active'` AND linked `partners.is_active = true`
- "Suspender" → reverses both
- Expandable view: campaigns + invoices for that partner

## 6. Notifications

On campaign creation, insert a row into `notifications` for each admin (`type = 'partner_campaign_new'`, link `/admin/annonsører`).

## 7. Invoicing

`amount_nok = round(impressions / 1000 * cpm_rate)` for CPM campaigns, or `budget_nok` proportional to month coverage for fixed campaigns. Cron job runs on day 1 at 02:00 UTC. PDF = browser print stylesheet on the invoice row (`window.print()` with a print-friendly route view).

## Open assumptions (will use these defaults unless you say otherwise)

- Partner auth uses Supabase email/password (no Google sign-in for partners — they're businesses, not consumers).
- Partner accounts created in `pending` status remain logged-in but see a "Søknaden er under behandling" notice on the dashboard until approved.
- Cron endpoint is unauthenticated but signature-protected with a new `PARTNER_CRON_SECRET` header.
- Invoice PDF is print-based; no server-side PDF generation library (keeps the Worker runtime simple).
- Each partner account owns exactly one `partners` row (one physical location). Multi-location support can come later.
