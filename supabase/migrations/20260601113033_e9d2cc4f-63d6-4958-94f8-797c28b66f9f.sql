-- 1) profiles: add username, bio, is_public
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Format constraint: 3-20 chars, lowercase a-z, 0-9, hyphens, no leading/trailing hyphen
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9]([a-z0-9-]{1,18}[a-z0-9])?$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 160);

-- Case-insensitive uniqueness on username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- Allow anyone (incl. anon) to read public profile fields when is_public = true.
-- We rely on app code to project only safe columns.
DROP POLICY IF EXISTS "public profiles readable" ON public.profiles;
CREATE POLICY "public profiles readable"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

GRANT SELECT ON public.profiles TO anon;

-- 2) vehicle_photos
CREATE TABLE IF NOT EXISTS public.vehicle_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id text NOT NULL,
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_photos_user_vehicle_idx
  ON public.vehicle_photos (user_id, vehicle_id, created_at DESC);

GRANT SELECT ON public.vehicle_photos TO anon;
GRANT SELECT, INSERT, DELETE ON public.vehicle_photos TO authenticated;
GRANT ALL ON public.vehicle_photos TO service_role;

ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own photos
DROP POLICY IF EXISTS "owner insert vehicle_photos" ON public.vehicle_photos;
CREATE POLICY "owner insert vehicle_photos"
  ON public.vehicle_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner select vehicle_photos" ON public.vehicle_photos;
CREATE POLICY "owner select vehicle_photos"
  ON public.vehicle_photos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner delete vehicle_photos" ON public.vehicle_photos;
CREATE POLICY "owner delete vehicle_photos"
  ON public.vehicle_photos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Anyone can read photos belonging to a public profile
DROP POLICY IF EXISTS "public select vehicle_photos" ON public.vehicle_photos;
CREATE POLICY "public select vehicle_photos"
  ON public.vehicle_photos
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = vehicle_photos.user_id AND p.is_public = true
  ));

-- 3) vehicle-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Public read of files
DROP POLICY IF EXISTS "vehicle-photos public read" ON storage.objects;
CREATE POLICY "vehicle-photos public read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'vehicle-photos');

-- Owner-scoped writes: path prefix is <user_id>/...
DROP POLICY IF EXISTS "vehicle-photos owner insert" ON storage.objects;
CREATE POLICY "vehicle-photos owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "vehicle-photos owner delete" ON storage.objects;
CREATE POLICY "vehicle-photos owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehicle-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );