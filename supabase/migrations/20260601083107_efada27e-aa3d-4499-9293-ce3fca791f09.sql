CREATE TABLE public.sent_trip_reminders (
  trip_id text NOT NULL PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  start_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sent_trip_reminders TO service_role;
GRANT ALL ON public.sent_trip_reminders TO service_role;

ALTER TABLE public.sent_trip_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage trip reminders"
  ON public.sent_trip_reminders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_sent_trip_reminders_owner ON public.sent_trip_reminders(owner_user_id);
