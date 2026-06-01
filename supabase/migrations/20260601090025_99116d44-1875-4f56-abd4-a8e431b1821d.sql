-- Add a token column for token-based public access
ALTER TABLE public.trip_live_sessions
  ADD COLUMN IF NOT EXISTS live_share_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS trip_live_sessions_token_idx
  ON public.trip_live_sessions (live_share_token);

-- Replace broad anon SELECT with a token-gated one. Realtime + REST clients
-- must filter by live_share_token; RLS ensures only rows with a token are
-- visible to anon.
DROP POLICY IF EXISTS "Anon can read live sessions" ON public.trip_live_sessions;

CREATE POLICY "Anon can read live sessions by token"
  ON public.trip_live_sessions
  FOR SELECT
  TO anon
  USING (live_share_token IS NOT NULL);

GRANT SELECT ON public.trip_live_sessions TO anon;
