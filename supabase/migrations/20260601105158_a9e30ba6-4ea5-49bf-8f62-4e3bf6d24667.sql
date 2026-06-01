
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  trip_id text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: companion joined
CREATE OR REPLACE FUNCTION public.notify_companion_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_joiner_name text;
  v_trip_title text;
  v_blob jsonb;
BEGIN
  IF NEW.status = 'joined' AND (OLD.status IS DISTINCT FROM 'joined') AND NEW.joined_user_id IS NOT NULL THEN
    v_owner := NEW.owner_user_id;
    IF v_owner = NEW.joined_user_id THEN
      RETURN NEW;
    END IF;
    SELECT display_name INTO v_joiner_name FROM public.profiles WHERE id = NEW.joined_user_id;
    SELECT data INTO v_blob FROM public.trips WHERE user_id = v_owner LIMIT 1;
    IF v_blob IS NOT NULL THEN
      SELECT t->>'title' INTO v_trip_title
        FROM jsonb_array_elements(COALESCE(v_blob->'trips','[]'::jsonb)) t
        WHERE t->>'id' = NEW.trip_id LIMIT 1;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, trip_id, link)
    VALUES (
      v_owner,
      'companion_joined',
      'Ny medreisende',
      COALESCE(v_joiner_name, 'Noen') || ' har blitt med på ' || COALESCE(v_trip_title, 'turen din'),
      NEW.trip_id,
      '/trips/' || NEW.trip_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_companion_joined
AFTER UPDATE ON public.trip_invites
FOR EACH ROW EXECUTE FUNCTION public.notify_companion_joined();

-- Trigger: new comment
CREATE OR REPLACE FUNCTION public.notify_trip_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_trip_title text;
  v_blob jsonb;
  v_author_name text;
BEGIN
  v_author_name := COALESCE(NEW.user_name, 'Noen');

  -- Collect all members of this trip (owner + joined invitees) excluding author
  FOR r IN
    SELECT DISTINCT m.user_id FROM (
      SELECT owner_user_id AS user_id FROM public.trip_invites WHERE trip_id = NEW.trip_id
      UNION
      SELECT joined_user_id AS user_id FROM public.trip_invites
        WHERE trip_id = NEW.trip_id AND status = 'joined' AND joined_user_id IS NOT NULL
    ) m WHERE m.user_id IS NOT NULL AND m.user_id <> NEW.user_id
  LOOP
    -- Fetch trip title from that user's blob if owner
    SELECT data INTO v_blob FROM public.trips WHERE user_id = r.user_id LIMIT 1;
    v_trip_title := NULL;
    IF v_blob IS NOT NULL THEN
      SELECT t->>'title' INTO v_trip_title
        FROM jsonb_array_elements(COALESCE(v_blob->'trips','[]'::jsonb)) t
        WHERE t->>'id' = NEW.trip_id LIMIT 1;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, trip_id, link)
    VALUES (
      r.user_id,
      'comment',
      'Ny kommentar',
      v_author_name || ' kommenterte på ' || COALESCE(v_trip_title, 'turen'),
      NEW.trip_id,
      '/trips/' || NEW.trip_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_trip_comment
AFTER INSERT ON public.trip_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_comment();
