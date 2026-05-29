
-- Public storage bucket for trip stop photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read so shared trip pages can display photos
CREATE POLICY "Trip photos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'trip-photos');

-- Authenticated users can upload only into their own user folder
CREATE POLICY "Users can upload their own trip photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own trip photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own trip photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
