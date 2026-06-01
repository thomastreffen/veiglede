CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.admin_settings TO anon, authenticated;
GRANT ALL ON public.admin_settings TO service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads admin_settings"
  ON public.admin_settings FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "admins manage admin_settings"
  ON public.admin_settings FOR ALL
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.admin_settings (key, value) VALUES
  ('site_name', '"Veiglede"'::jsonb),
  ('contact_email', '"kontakt@veiglede.no"'::jsonb),
  ('max_free_trips', '10'::jsonb),
  ('max_free_vehicles', '2'::jsonb),
  ('is_maintenance_mode', 'false'::jsonb),
  ('pro_monthly_nok', '79'::jsonb),
  ('pro_yearly_nok', '599'::jsonb),
  ('gruppe_monthly_nok', '199'::jsonb),
  ('max_gruppe_members', '20'::jsonb),
  ('default_cpm_nok', '15'::jsonb),
  ('max_partner_radius_km', '50'::jsonb),
  ('partner_auto_approve', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;