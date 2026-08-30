UPDATE public.app_settings
SET value_text = jsonb_set(
  COALESCE(value_text::jsonb, '{}'::jsonb),
  '{membershipPriceUsd}',
  '2.99'::jsonb,
  true
)::text,
updated_at = now()
WHERE key = 'gap_revenue_settings';
