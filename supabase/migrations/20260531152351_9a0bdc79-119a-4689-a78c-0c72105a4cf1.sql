
-- 1) Add role to trip_invites + index
ALTER TABLE public.trip_invites
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'viewer';

ALTER TABLE public.trip_invites
  DROP CONSTRAINT IF EXISTS trip_invites_role_check;
ALTER TABLE public.trip_invites
  ADD CONSTRAINT trip_invites_role_check CHECK (role IN ('viewer', 'editor'));

CREATE INDEX IF NOT EXISTS trip_invites_token_idx ON public.trip_invites(invite_token);
CREATE INDEX IF NOT EXISTS trip_invites_joined_user_idx
  ON public.trip_invites(joined_user_id) WHERE status = 'joined';

-- Allow joined invitees to see their own invite row (needed for "trips I follow" + role gating)
DROP POLICY IF EXISTS "Joined member can view own invite" ON public.trip_invites;
CREATE POLICY "Joined member can view own invite"
  ON public.trip_invites FOR SELECT
  TO authenticated
  USING (auth.uid() = joined_user_id);

-- 2) trip_comments
CREATE TABLE IF NOT EXISTS public.trip_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text,
  user_avatar_url text,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_comments TO authenticated;
GRANT ALL ON public.trip_comments TO service_role;

ALTER TABLE public.trip_comments ENABLE ROW LEVEL SECURITY;

-- Helper: is current user a member of this trip (owner or accepted invitee)
CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_invites
    WHERE trip_id = _trip_id
      AND (
        (owner_user_id = _user_id)
        OR (joined_user_id = _user_id AND status = 'joined')
      )
  );
$$;

DROP POLICY IF EXISTS "Members can view comments" ON public.trip_comments;
CREATE POLICY "Members can view comments"
  ON public.trip_comments FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Members can post comments" ON public.trip_comments;
CREATE POLICY "Members can post comments"
  ON public.trip_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND public.is_trip_member(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authors can update own comments" ON public.trip_comments;
CREATE POLICY "Authors can update own comments"
  ON public.trip_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete own comments" ON public.trip_comments;
CREATE POLICY "Authors can delete own comments"
  ON public.trip_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_comments;
ALTER TABLE public.trip_comments REPLICA IDENTITY FULL;

-- 3) get_invite_preview(token) — public: returns trip lite + invite metadata for join page
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.trip_invites%ROWTYPE;
  v_blob jsonb;
  v_trip jsonb;
  v_owner_name text;
BEGIN
  SELECT * INTO v_invite FROM public.trip_invites WHERE invite_token = p_token;
  IF NOT FOUND OR v_invite.status = 'revoked' THEN
    RETURN NULL;
  END IF;

  SELECT data INTO v_blob FROM public.trips WHERE user_id = v_invite.owner_user_id LIMIT 1;
  IF v_blob IS NOT NULL THEN
    SELECT t INTO v_trip
      FROM jsonb_array_elements(COALESCE(v_blob->'trips','[]'::jsonb)) t
      WHERE t->>'id' = v_invite.trip_id LIMIT 1;
  END IF;

  SELECT display_name INTO v_owner_name FROM public.profiles WHERE id = v_invite.owner_user_id;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'trip_id', v_invite.trip_id,
      'status', v_invite.status,
      'role', v_invite.role,
      'invited_email', v_invite.invited_email,
      'owner_user_id', v_invite.owner_user_id,
      'joined_user_id', v_invite.joined_user_id,
      'created_at', v_invite.created_at
    ),
    'trip', v_trip,
    'owner_name', v_owner_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;

-- 4) decline_invite
CREATE OR REPLACE FUNCTION public.decline_invite(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.trip_invites
     SET status = 'revoked'
   WHERE invite_token = p_token
     AND (joined_user_id = v_uid OR joined_user_id IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_invite(text) TO authenticated;

-- 5) list_followed_trips — returns array of {trip, owner, role, share_token}
CREATE OR REPLACE FUNCTION public.list_followed_trips()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb := '[]'::jsonb;
  r record;
  v_blob jsonb;
  v_trip jsonb;
  v_owner_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR r IN
    SELECT trip_id, owner_user_id, role
      FROM public.trip_invites
     WHERE joined_user_id = v_uid AND status = 'joined'
  LOOP
    SELECT data INTO v_blob FROM public.trips WHERE user_id = r.owner_user_id LIMIT 1;
    IF v_blob IS NULL THEN CONTINUE; END IF;

    SELECT t INTO v_trip
      FROM jsonb_array_elements(COALESCE(v_blob->'trips','[]'::jsonb)) t
      WHERE t->>'id' = r.trip_id LIMIT 1;
    IF v_trip IS NULL THEN CONTINUE; END IF;

    SELECT display_name INTO v_owner_name FROM public.profiles WHERE id = r.owner_user_id;

    v_result := v_result || jsonb_build_object(
      'trip', v_trip,
      'role', r.role,
      'owner_user_id', r.owner_user_id,
      'owner_name', v_owner_name
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_followed_trips() TO authenticated;

-- 6) list_trip_members — owner + accepted invitees with profile info
CREATE OR REPLACE FUNCTION public.list_trip_members(p_trip_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_trip_member(p_trip_id, v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.trip_invites
    WHERE trip_id = p_trip_id LIMIT 1;

  -- If no invites yet but caller owns the trip (via trips table), derive from there
  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.trips
      WHERE data->'trips' @> jsonb_build_array(jsonb_build_object('id', p_trip_id))
      LIMIT 1;
  END IF;

  IF v_owner IS NOT NULL THEN
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'user_id', v_owner,
      'role', 'owner',
      'name', (SELECT display_name FROM public.profiles WHERE id = v_owner),
      'avatar_url', (SELECT avatar_url FROM public.profiles WHERE id = v_owner)
    ));
  END IF;

  SELECT v_result || COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', i.joined_user_id,
    'role', i.role,
    'name', p.display_name,
    'avatar_url', p.avatar_url
  )), '[]'::jsonb)
  INTO v_result
  FROM public.trip_invites i
  LEFT JOIN public.profiles p ON p.id = i.joined_user_id
  WHERE i.trip_id = p_trip_id AND i.status = 'joined' AND i.joined_user_id IS NOT NULL;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_trip_members(text) TO authenticated;
