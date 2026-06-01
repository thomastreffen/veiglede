
-- user_follows
CREATE TABLE public.user_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.user_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT ALL ON public.user_follows TO service_role;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads follows" ON public.user_follows FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users insert own follow" ON public.user_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "users delete own follow" ON public.user_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

-- trip_reactions
CREATE TABLE public.trip_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('fire','clap','pin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id, reaction)
);
GRANT SELECT ON public.trip_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.trip_reactions TO authenticated;
GRANT ALL ON public.trip_reactions TO service_role;
ALTER TABLE public.trip_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads reactions" ON public.trip_reactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users insert own reaction" ON public.trip_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own reaction" ON public.trip_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_trip_reactions_trip ON public.trip_reactions(trip_id);

-- saved_trips
CREATE TABLE public.saved_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_trip_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_trip_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_trips TO authenticated;
GRANT ALL ON public.saved_trips TO service_role;
ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads saved" ON public.saved_trips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner inserts saved" ON public.saved_trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes saved" ON public.saved_trips FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_saved_trips_user ON public.saved_trips(user_id);
