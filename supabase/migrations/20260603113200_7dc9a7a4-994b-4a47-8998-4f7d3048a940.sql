-- 1) admin_settings: remove broad public SELECT (server fn uses service role)
DROP POLICY IF EXISTS "anyone reads admin_settings" ON public.admin_settings;

-- 2) trip_photos: remove broad anon SELECT (only used by authenticated owners)
DROP POLICY IF EXISTS "public select trip_photos" ON public.trip_photos;

-- 3) trip_live_sessions: remove the always-true anon policy, replace with token-scoped RPC
DROP POLICY IF EXISTS "Anon can read live sessions by token" ON public.trip_live_sessions;

CREATE OR REPLACE FUNCTION public.get_live_session_by_token(p_token uuid)
RETURNS public.trip_live_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.trip_live_sessions
   WHERE live_share_token = p_token
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_session_by_token(uuid) TO anon, authenticated;

-- 4) profiles: prevent self role escalation via trigger
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Only admins can change role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 5) benefit_providers: don't expose contact_email to anon (still readable by admin/owner via service role + authenticated grants)
REVOKE SELECT (contact_email) ON public.benefit_providers FROM anon;

-- 6) Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
