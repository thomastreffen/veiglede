
CREATE TABLE IF NOT EXISTS public.trip_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id text NOT NULL,
  stop_id text,
  user_id uuid NOT NULL,
  url text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_photos_trip_id_idx ON public.trip_photos(trip_id);
CREATE INDEX IF NOT EXISTS trip_photos_user_id_idx ON public.trip_photos(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_photos TO authenticated;
GRANT SELECT ON public.trip_photos TO anon;
GRANT ALL ON public.trip_photos TO service_role;

ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select trip_photos" ON public.trip_photos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner insert trip_photos" ON public.trip_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update trip_photos" ON public.trip_photos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner delete trip_photos" ON public.trip_photos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow public (anon) read for shared trips functionality
CREATE POLICY "public select trip_photos" ON public.trip_photos
  FOR SELECT TO anon USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_photos;
