ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Existing profiles with all required identity, location, and emergency-contact
-- fields already supplied should not be forced through onboarding again.
UPDATE public.profiles
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND NULLIF(BTRIM(full_name), '') IS NOT NULL
  AND NULLIF(BTRIM(COALESCE(mobile_phone, phone)), '') IS NOT NULL
  AND NULLIF(BTRIM(home_address), '') IS NOT NULL
  AND NULLIF(BTRIM(city), '') IS NOT NULL
  AND NULLIF(BTRIM(state), '') IS NOT NULL
  AND NULLIF(BTRIM(zip), '') IS NOT NULL
  AND NULLIF(BTRIM(emergency_contact->>'name'), '') IS NOT NULL
  AND NULLIF(BTRIM(emergency_contact->>'phone'), '') IS NOT NULL
  AND NULLIF(BTRIM(emergency_contact->>'relation'), '') IS NOT NULL;

COMMENT ON COLUMN public.profiles.onboarding_completed IS
  'True after the authenticated user completes required account setup.';
