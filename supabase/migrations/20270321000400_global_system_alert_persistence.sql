-- Persist the global system alert in Supabase so it syncs across devices.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value_text TEXT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App settings can view" ON public.app_settings;
CREATE POLICY "App settings can view"
  ON public.app_settings FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "App settings can insert" ON public.app_settings;
CREATE POLICY "App settings can insert"
  ON public.app_settings FOR INSERT
  WITH CHECK (public.is_admin() OR public.is_institution_admin());

DROP POLICY IF EXISTS "App settings can update" ON public.app_settings;
CREATE POLICY "App settings can update"
  ON public.app_settings FOR UPDATE
  USING (public.is_admin() OR public.is_institution_admin())
  WITH CHECK (public.is_admin() OR public.is_institution_admin());

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON public.app_settings(updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_app_settings_updated_at();

INSERT INTO public.app_settings (key, value_text)
VALUES ('global_system_alert', '')
ON CONFLICT (key) DO NOTHING;