CREATE TABLE public.help_bot_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  helpful boolean NOT NULL,
  feedback_text text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.help_bot_feedback TO anon, authenticated;
GRANT SELECT ON public.help_bot_feedback TO authenticated;
GRANT ALL ON public.help_bot_feedback TO service_role;

ALTER TABLE public.help_bot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit help bot feedback"
  ON public.help_bot_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins can read help bot feedback"
  ON public.help_bot_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_help_bot_feedback_created_at ON public.help_bot_feedback (created_at DESC);
CREATE INDEX idx_help_bot_feedback_helpful ON public.help_bot_feedback (helpful);