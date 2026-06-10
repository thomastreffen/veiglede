
CREATE POLICY "profile-avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-avatars');

CREATE POLICY "profile-avatars owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "profile-avatars owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "profile-avatars owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
