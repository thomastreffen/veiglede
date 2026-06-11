
ALTER TABLE public.trip_reactions DROP CONSTRAINT IF EXISTS trip_reactions_reaction_check;
UPDATE public.trip_reactions SET reaction = 'drive' WHERE reaction = 'clap';
ALTER TABLE public.trip_reactions ADD CONSTRAINT trip_reactions_reaction_check CHECK (reaction = ANY (ARRAY['fire'::text, 'road'::text, 'pin'::text, 'coffee'::text, 'drive'::text]));
CREATE INDEX IF NOT EXISTS idx_trip_reactions_trip_reaction ON public.trip_reactions(trip_id, reaction);
CREATE INDEX IF NOT EXISTS idx_saved_trips_source ON public.saved_trips(source_trip_id);
