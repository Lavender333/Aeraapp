-- Global People Served counter
-- Run this in Supabase SQL editor to create a single-row, atomically incremented counter.

CREATE TABLE IF NOT EXISTS public.app_metrics (
  key text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_metrics (key, value)
VALUES ('people_served', 0)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_people_served()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.app_metrics (key, value, updated_at)
  VALUES ('people_served', 1, now())
  ON CONFLICT (key)
  DO UPDATE SET
    value = app_metrics.value + 1,
    updated_at = now()
  RETURNING value INTO v_next;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_people_served_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_metrics WHERE key = 'people_served' LIMIT 1),
    0
  )::bigint;
$$;

REVOKE ALL ON FUNCTION public.increment_people_served() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_people_served_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_people_served() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_served_count() TO anon, authenticated;
