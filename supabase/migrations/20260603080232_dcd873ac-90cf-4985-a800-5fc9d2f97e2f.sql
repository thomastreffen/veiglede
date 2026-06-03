CREATE TABLE IF NOT EXISTS public.contact_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'kontaktskjema'
    CHECK (source IN ('kontaktskjema', 'partner', 'bruker', 'annet')),
  status TEXT NOT NULL DEFAULT 'ny'
    CHECK (status IN ('ny', 'åpen', 'besvart', 'lukket')),
  name TEXT,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.contact_tickets TO service_role;

ALTER TABLE public.contact_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages tickets"
  ON public.contact_tickets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS contact_tickets_status_idx ON public.contact_tickets(status);
CREATE INDEX IF NOT EXISTS contact_tickets_created_at_idx ON public.contact_tickets(created_at DESC);

CREATE TRIGGER contact_tickets_set_updated_at
BEFORE UPDATE ON public.contact_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();