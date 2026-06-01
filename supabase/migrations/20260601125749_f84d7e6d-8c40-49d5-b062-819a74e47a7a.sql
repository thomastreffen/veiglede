-- Helper to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','gruppe')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription select" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin select all subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "admin update all subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "admin insert subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan ON public.subscriptions(plan);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Gruppe members
CREATE TABLE public.gruppe_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gruppe_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gruppe_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gruppe_members TO authenticated;
GRANT ALL ON public.gruppe_members TO service_role;
ALTER TABLE public.gruppe_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_gruppe_member(_gruppe_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gruppe_members WHERE gruppe_id = _gruppe_id AND user_id = _user_id);
$$;

CREATE POLICY "members read gruppe" ON public.gruppe_members FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR gruppe_id = auth.uid() OR public.is_gruppe_member(gruppe_id, auth.uid())
);
CREATE POLICY "owner manages gruppe insert" ON public.gruppe_members FOR INSERT TO authenticated WITH CHECK (gruppe_id = auth.uid());
CREATE POLICY "owner manages gruppe delete" ON public.gruppe_members FOR DELETE TO authenticated USING (gruppe_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "admin all gruppe" ON public.gruppe_members FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE INDEX idx_gruppe_members_gruppe ON public.gruppe_members(gruppe_id);
CREATE INDEX idx_gruppe_members_user ON public.gruppe_members(user_id);

-- Auto-create free subscription on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill
INSERT INTO public.subscriptions (user_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;