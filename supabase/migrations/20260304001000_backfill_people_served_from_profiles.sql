-- Backfill people_registered metric from existing user base.
-- Safe for already deployed environments: raises value to at least profiles count.

INSERT INTO public.app_metrics (key, value, updated_at)
VALUES (
  'people_registered',
  COALESCE((SELECT COUNT(*)::bigint FROM public.profiles), 0),
  now()
)
ON CONFLICT (key)
DO UPDATE SET
  value = GREATEST(
    public.app_metrics.value,
    COALESCE((SELECT COUNT(*)::bigint FROM public.profiles), 0)
  ),
  updated_at = now();
