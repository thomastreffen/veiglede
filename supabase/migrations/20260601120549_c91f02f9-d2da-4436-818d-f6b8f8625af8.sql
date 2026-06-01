-- Add role & is_active to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user','admin'));

-- Security-definer admin check (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _uid AND role = 'admin'
  );
$$;

-- Allow admins to read/update all profiles (admin panel)
CREATE POLICY "admins read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "admins update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('mat','overnatting','attraksjon','drivstoff')),
  logo_url text,
  website text,
  lat double precision,
  lng double precision,
  region text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Anyone can read active partners (used by route suggester)
CREATE POLICY "anyone reads active partners"
ON public.partners FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Admins manage partners
CREATE POLICY "admins read all partners"
ON public.partners FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "admins insert partners"
ON public.partners FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins update partners"
ON public.partners FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "admins delete partners"
ON public.partners FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_partners_active_geo ON public.partners (is_active, lat, lng);
CREATE INDEX idx_partners_region ON public.partners (region);
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_created_at ON public.profiles (created_at);