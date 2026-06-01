ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_garage boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_trips  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_stats  boolean NOT NULL DEFAULT true;