-- Add analytics counters to partners
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_this_month integer NOT NULL DEFAULT 0;

-- Atomic increment helpers (callable by anon + authenticated; only touch counters)
CREATE OR REPLACE FUNCTION public.increment_partner_impression(p_partner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.partners
     SET impressions = impressions + 1,
         impressions_this_month = impressions_this_month + 1
   WHERE id = p_partner_id AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.increment_partner_click(p_partner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.partners
     SET clicks = clicks + 1,
         clicks_this_month = clicks_this_month + 1
   WHERE id = p_partner_id AND is_active = true;
$$;

-- Monthly reset, called by pg_cron on day 1 of each month
CREATE OR REPLACE FUNCTION public.reset_partner_monthly_stats()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.partners
     SET impressions_this_month = 0,
         clicks_this_month = 0;
$$;

GRANT EXECUTE ON FUNCTION public.increment_partner_impression(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_partner_click(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_partner_monthly_stats() TO service_role;