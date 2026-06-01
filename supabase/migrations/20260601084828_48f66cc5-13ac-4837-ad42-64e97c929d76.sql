
-- Live trip sharing sessions
CREATE TABLE public.trip_live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL,
  user_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  last_stop_name text,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

GRANT SELECT ON public.trip_live_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_live_sessions TO authenticated;
GRANT ALL ON public.trip_live_sessions TO service_role;

ALTER TABLE public.trip_live_sessions ENABLE ROW LEVEL SECURITY;

-- Owner can do anything on their own row
CREATE POLICY "Owner can insert live session"
  ON public.trip_live_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can update own live session"
  ON public.trip_live_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete own live session"
  ON public.trip_live_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Owners and trip companions (joined invites) can read
CREATE POLICY "Owner or companion can read live session"
  ON public.trip_live_sessions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_trip_member(trip_id, auth.uid())
  );

-- Anonymous viewers (shared link) can read live sessions.
-- Position is intentionally shareable; trip_id is required to query.
CREATE POLICY "Anon can read live sessions"
  ON public.trip_live_sessions FOR SELECT TO anon
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_live_sessions;
ALTER TABLE public.trip_live_sessions REPLICA IDENTITY FULL;

CREATE INDEX idx_trip_live_sessions_trip_id ON public.trip_live_sessions (trip_id);
