ALTER TABLE public.partner_invoices
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_receipt_url text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS partner_invoices_stripe_session_id_idx
  ON public.partner_invoices (stripe_session_id);