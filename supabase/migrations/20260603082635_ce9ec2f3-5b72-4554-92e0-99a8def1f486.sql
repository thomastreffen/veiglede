ALTER TABLE public.contact_tickets
  DROP CONSTRAINT IF EXISTS contact_tickets_source_check;

ALTER TABLE public.contact_tickets
  ADD CONSTRAINT contact_tickets_source_check
    CHECK (source IN ('kontaktskjema', 'partner', 'bruker', 'epost', 'annet'));