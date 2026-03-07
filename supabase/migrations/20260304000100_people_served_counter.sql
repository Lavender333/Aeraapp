-- Global People Registered counter
-- Idempotent migration for CI/CD deployment via supabase db push

CREATE TABLE IF NOT EXISTS public.app_metrics (
  key text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_metrics (key, value)
VALUES (
  'people_registered',
  COALESCE((SELECT COUNT(*)::bigint FROM public.profiles), 0)
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_people_registered()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.app_metrics (key, value, updated_at)
  VALUES ('people_registered', 1, now())
  ON CONFLICT (key)
  DO UPDATE SET
    value = app_metrics.value + 1,
    updated_at = now()
  RETURNING value INTO v_next;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_people_registered_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_metrics WHERE key = 'people_registered' LIMIT 1),
    0
  )::bigint;
$$;

REVOKE ALL ON FUNCTION public.increment_people_registered() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_people_registered_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_people_registered() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_registered_count() TO anon, authenticated;
