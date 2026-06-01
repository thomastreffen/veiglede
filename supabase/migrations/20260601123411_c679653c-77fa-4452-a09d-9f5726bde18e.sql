-- Storage bucket for partner logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "partner-logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

CREATE POLICY "partner-logos owner upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'partner-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "partner-logos owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'partner-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "partner-logos owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'partner-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ===================== partner_accounts =====================
CREATE TABLE public.partner_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  org_number text,
  category text NOT NULL CHECK (category IN ('mat','overnatting','attraksjon','drivstoff','annet')),
  website text,
  logo_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_accounts TO authenticated;
GRANT ALL ON public.partner_accounts TO service_role;

ALTER TABLE public.partner_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own partner_account select" ON public.partner_accounts
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own partner_account insert" ON public.partner_accounts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own partner_account update" ON public.partner_accounts
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admin select all partner_accounts" ON public.partner_accounts
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admin update all partner_accounts" ON public.partner_accounts
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ===================== partner_campaigns =====================
CREATE TABLE public.partner_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_account_id uuid NOT NULL REFERENCES public.partner_accounts(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  name text NOT NULL,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  budget_nok integer NOT NULL CHECK (budget_nok >= 500),
  pricing_model text NOT NULL DEFAULT 'cpm' CHECK (pricing_model IN ('cpm','fixed')),
  cpm_rate integer NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_campaigns_account ON public.partner_campaigns(partner_account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_campaigns TO authenticated;
GRANT ALL ON public.partner_campaigns TO service_role;

ALTER TABLE public.partner_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own campaigns select" ON public.partner_campaigns
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.partner_accounts a WHERE a.id = partner_account_id AND a.user_id = auth.uid()));

CREATE POLICY "own campaigns insert" ON public.partner_campaigns
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.partner_accounts a WHERE a.id = partner_account_id AND a.user_id = auth.uid()));

CREATE POLICY "own campaigns update" ON public.partner_campaigns
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.partner_accounts a WHERE a.id = partner_account_id AND a.user_id = auth.uid()));

CREATE POLICY "own campaigns delete" ON public.partner_campaigns
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.partner_accounts a WHERE a.id = partner_account_id AND a.user_id = auth.uid()));

CREATE POLICY "admin select all campaigns" ON public.partner_campaigns
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admin update all campaigns" ON public.partner_campaigns
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ===================== partner_invoices =====================
CREATE TABLE public.partner_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_account_id uuid NOT NULL REFERENCES public.partner_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.partner_campaigns(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  amount_nok integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_invoices_account ON public.partner_invoices(partner_account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_invoices TO authenticated;
GRANT ALL ON public.partner_invoices TO service_role;

ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own invoices select" ON public.partner_invoices
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.partner_accounts a WHERE a.id = partner_account_id AND a.user_id = auth.uid()));

CREATE POLICY "admin select all invoices" ON public.partner_invoices
FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admin update all invoices" ON public.partner_invoices
FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ===================== Monthly invoice cron =====================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'partner-invoices-monthly',
  '0 2 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://project--87475a04-b786-464d-9515-5abff27287c0.lovable.app/api/public/cron/generate-partner-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYWZiZ2Npc2xobmd3Y3pkeHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzM1MzksImV4cCI6MjA5NTQ0OTUzOX0.Rh5rDhXdSAjWuJN9JOsKEhbj_ZVjFSI9LaLxU4YPCRE'
    ),
    body := '{}'::jsonb
  );
  $$
);