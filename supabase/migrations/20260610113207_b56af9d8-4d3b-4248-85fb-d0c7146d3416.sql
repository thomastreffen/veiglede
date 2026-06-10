-- Default profiles to private. Existing visible profiles also flip to private,
-- so users explicitly opt back in from Settings → Personvern.
ALTER TABLE public.profiles ALTER COLUMN is_public SET DEFAULT false;
UPDATE public.profiles SET is_public = false WHERE is_public = true;