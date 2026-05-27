
-- Profiles: 1 rad per auth-bruker
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  theme text NOT NULL DEFAULT 'system',
  onboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Driver preferences: 1 rad per bruker, hele preference-objektet som JSON
CREATE TABLE public.driver_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_prefs TO authenticated;
GRANT ALL ON public.driver_prefs TO service_role;
ALTER TABLE public.driver_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs select" ON public.driver_prefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs insert" ON public.driver_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.driver_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs delete" ON public.driver_prefs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Vehicles: JSON-blob per kjøretøy
CREATE TABLE public.vehicles (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_user_idx ON public.vehicles(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vehicles select" ON public.vehicles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own vehicles insert" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vehicles update" ON public.vehicles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own vehicles delete" ON public.vehicles FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trips: JSON-blob per tur (inneholder dager/stopp/sporing som i dag)
CREATE TABLE public.trips (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trips_user_idx ON public.trips(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trips select" ON public.trips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own trips insert" ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own trips update" ON public.trips FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own trips delete" ON public.trips FOR DELETE TO authenticated USING (auth.uid() = user_id);
