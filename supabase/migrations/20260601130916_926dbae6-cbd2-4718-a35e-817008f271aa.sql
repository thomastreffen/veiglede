
-- Benefit providers
CREATE TABLE public.benefit_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  website text,
  description text CHECK (char_length(description) <= 300),
  category text NOT NULL CHECK (category IN ('rekvisita','verksted','forsikring','utstyr','lading','camping','annet')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  contact_email text NOT NULL,
  monthly_fee_nok integer NOT NULL DEFAULT 499,
  partner_account_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.benefit_providers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.benefit_providers TO authenticated;
GRANT ALL ON public.benefit_providers TO service_role;
ALTER TABLE public.benefit_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active benefit_providers" ON public.benefit_providers
  FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "admins all benefit_providers" ON public.benefit_providers
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "owner reads benefit_providers" ON public.benefit_providers
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM partner_accounts a WHERE a.id = benefit_providers.partner_account_id AND a.user_id = auth.uid())
  );
CREATE POLICY "owner updates benefit_providers" ON public.benefit_providers
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM partner_accounts a WHERE a.id = benefit_providers.partner_account_id AND a.user_id = auth.uid())
  );

-- Benefits
CREATE TABLE public.benefits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES public.benefit_providers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text CHECK (char_length(description) <= 300),
  discount_code text,
  affiliate_url text,
  direct_url text NOT NULL,
  vehicle_types text[] NOT NULL DEFAULT '{}',
  energy_types text[] NOT NULL DEFAULT '{}',
  valid_from date,
  valid_to date,
  is_active boolean NOT NULL DEFAULT true,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  code_copies integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.benefits TO authenticated;
GRANT ALL ON public.benefits TO service_role;
ALTER TABLE public.benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth reads active benefits" ON public.benefits
  FOR SELECT TO authenticated USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.benefit_providers p
      WHERE p.id = benefits.provider_id AND p.status = 'active'
    )
  );
CREATE POLICY "admins all benefits" ON public.benefits
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "owner manages benefits" ON public.benefits
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.benefit_providers p
      JOIN public.partner_accounts a ON a.id = p.partner_account_id
      WHERE p.id = benefits.provider_id AND a.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.benefit_providers p
      JOIN public.partner_accounts a ON a.id = p.partner_account_id
      WHERE p.id = benefits.provider_id AND a.user_id = auth.uid()
    )
  );

-- User benefit consents
CREATE TABLE public.user_benefit_consents (
  user_id uuid NOT NULL PRIMARY KEY,
  consent_targeting boolean NOT NULL DEFAULT false,
  consent_analytics boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_benefit_consents TO authenticated;
GRANT ALL ON public.user_benefit_consents TO service_role;
ALTER TABLE public.user_benefit_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own consent select" ON public.user_benefit_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own consent insert" ON public.user_benefit_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own consent update" ON public.user_benefit_consents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin select consents" ON public.user_benefit_consents
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- profiles.benefits_opt_in
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS benefits_opt_in boolean NOT NULL DEFAULT false;

-- updated_at triggers
CREATE TRIGGER trg_benefit_providers_updated BEFORE UPDATE ON public.benefit_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_benefits_updated BEFORE UPDATE ON public.benefits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_user_benefit_consents_updated BEFORE UPDATE ON public.user_benefit_consents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic counters
CREATE OR REPLACE FUNCTION public.increment_benefit_impression(p_benefit_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.benefits SET impressions = impressions + 1 WHERE id = p_benefit_id AND is_active = true;
$$;
CREATE OR REPLACE FUNCTION public.increment_benefit_click(p_benefit_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.benefits SET clicks = clicks + 1 WHERE id = p_benefit_id AND is_active = true;
$$;
CREATE OR REPLACE FUNCTION public.increment_benefit_code_copy(p_benefit_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.benefits SET code_copies = code_copies + 1 WHERE id = p_benefit_id AND is_active = true;
$$;
