
-- Trip invites: shared trip planning v1
CREATE TABLE public.trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL,
  owner_user_id uuid NOT NULL,
  invited_email text,
  invite_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','opened','joined','revoked')),
  joined_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  joined_at timestamptz
);

CREATE INDEX idx_trip_invites_owner ON public.trip_invites(owner_user_id);
CREATE INDEX idx_trip_invites_trip ON public.trip_invites(trip_id);
CREATE INDEX idx_trip_invites_joined_user ON public.trip_invites(joined_user_id);

-- Grants: no anon access; owner manages via auth; lookups go through SECURITY DEFINER RPCs.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_invites TO authenticated;
GRANT ALL ON public.trip_invites TO service_role;

ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own invites"
  ON public.trip_invites FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Owner can create invites"
  ON public.trip_invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owner can update own invites"
  ON public.trip_invites FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Owner can delete own invites"
  ON public.trip_invites FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

-- Public RPC: fetch the shared trip for a token. Returns invite + the
-- single trip slice (trip + days + stops) extracted from the owner's
-- trips.data blob. Marks the invite as opened on first read.
CREATE OR REPLACE FUNCTION public.get_shared_trip(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.trip_invites%ROWTYPE;
  v_blob jsonb;
  v_trip jsonb;
  v_days jsonb;
  v_stops jsonb;
  v_day_ids jsonb;
BEGIN
  SELECT * INTO v_invite FROM public.trip_invites WHERE invite_token = p_token;
  IF NOT FOUND OR v_invite.status = 'revoked' THEN
    RETURN NULL;
  END IF;

  -- Mark opened (first time only)
  IF v_invite.opened_at IS NULL THEN
    UPDATE public.trip_invites
      SET opened_at = now(),
          status = CASE WHEN status = 'invited' THEN 'opened' ELSE status END
      WHERE id = v_invite.id;
  END IF;

  SELECT data INTO v_blob FROM public.trips WHERE user_id = v_invite.owner_user_id;
  IF v_blob IS NULL THEN
    RETURN jsonb_build_object(
      'invite', to_jsonb(v_invite),
      'trip', NULL, 'days', '[]'::jsonb, 'stops', '[]'::jsonb
    );
  END IF;

  -- Extract single trip
  SELECT t INTO v_trip
    FROM jsonb_array_elements(COALESCE(v_blob->'trips','[]'::jsonb)) t
    WHERE t->>'id' = v_invite.trip_id LIMIT 1;

  SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) INTO v_days
    FROM jsonb_array_elements(COALESCE(v_blob->'days','[]'::jsonb)) d
    WHERE d->>'tripId' = v_invite.trip_id;

  SELECT COALESCE(jsonb_agg(d->>'id'), '[]'::jsonb) INTO v_day_ids
    FROM jsonb_array_elements(COALESCE(v_blob->'days','[]'::jsonb)) d
    WHERE d->>'tripId' = v_invite.trip_id;

  SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) INTO v_stops
    FROM jsonb_array_elements(COALESCE(v_blob->'stops','[]'::jsonb)) s
    WHERE v_day_ids ? (s->>'dayId');

  RETURN jsonb_build_object(
    'invite', to_jsonb(v_invite),
    'trip', v_trip,
    'days', v_days,
    'stops', v_stops
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_trip(text) TO anon, authenticated;

-- Join trip: requires authenticated user. Sets joined_user_id + status.
CREATE OR REPLACE FUNCTION public.join_trip_with_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite public.trip_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO v_invite FROM public.trip_invites WHERE invite_token = p_token;
  IF NOT FOUND OR v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;
  IF v_invite.owner_user_id = v_uid THEN
    -- Owner opening own link; no-op
    RETURN to_jsonb(v_invite);
  END IF;
  UPDATE public.trip_invites
    SET joined_user_id = v_uid,
        joined_at = COALESCE(joined_at, now()),
        status = 'joined'
    WHERE id = v_invite.id
    RETURNING * INTO v_invite;
  RETURN to_jsonb(v_invite);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_trip_with_token(text) TO authenticated;
