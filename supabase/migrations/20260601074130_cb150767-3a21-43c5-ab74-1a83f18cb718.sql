-- Account deletion (soft) with 30-day restore window
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  restore_token uuid NOT NULL DEFAULT gen_random_uuid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  restore_before timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  restored_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_token ON public.account_deletion_requests(restore_token);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_user ON public.account_deletion_requests(user_id);

GRANT SELECT, INSERT, UPDATE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can create deletion requests"
  ON public.account_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RPC: restore an account by token (public — no auth required since user may be logged out)
CREATE OR REPLACE FUNCTION public.restore_account_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.account_deletion_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.account_deletion_requests
   WHERE restore_token = p_token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_req.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_deleted');
  END IF;

  IF v_req.restored_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_restored');
  END IF;

  IF v_req.restore_before < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  UPDATE public.account_deletion_requests
     SET restored_at = now()
   WHERE id = v_req.id;

  RETURN jsonb_build_object('ok', true, 'reason', 'restored');
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_account_by_token(uuid) TO anon, authenticated;