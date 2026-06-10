CREATE OR REPLACE FUNCTION public.get_live_trip_meta_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.trip_live_sessions%ROWTYPE;
  v_blob jsonb;
  v_vehicle text;
BEGIN
  SELECT * INTO v_session FROM public.trip_live_sessions
    WHERE live_share_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT data INTO v_blob FROM public.trips WHERE user_id = v_session.user_id LIMIT 1;
  IF v_blob IS NULL THEN
    RETURN jsonb_build_object('vehicle_type', NULL);
  END IF;

  SELECT t->>'vehicle' INTO v_vehicle
    FROM jsonb_array_elements(COALESCE(v_blob->'trips','[]'::jsonb)) t
    WHERE t->>'id' = v_session.trip_id
    LIMIT 1;

  RETURN jsonb_build_object('vehicle_type', v_vehicle);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_trip_meta_by_token(uuid) TO anon, authenticated;