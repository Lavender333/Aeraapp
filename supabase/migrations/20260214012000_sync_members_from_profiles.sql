-- Keep members directory synchronized with profile org linkage/contact fields.
-- This ensures users with profiles.org_id appear in members without relying on app-only sync paths.

CREATE OR REPLACE FUNCTION public.sync_member_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.members
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.org_id IS NULL THEN
    DELETE FROM public.members
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.members (
    id,
    org_id,
    name,
    status,
    needs,
    phone,
    address,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relation,
    created_by
  )
  VALUES (
    NEW.id,
    NEW.org_id,
    COALESCE(NULLIF(TRIM(NEW.full_name), ''), NULLIF(NEW.email, ''), 'Member'),
    'UNKNOWN',
    ARRAY[]::TEXT[],
    COALESCE(NEW.phone, NEW.mobile_phone),
    NEW.home_address,
    NEW.emergency_contact->>'name',
    NEW.emergency_contact->>'phone',
    NEW.emergency_contact->>'relation',
    NEW.id
  )
  ON CONFLICT (id)
  DO UPDATE SET
    org_id = EXCLUDED.org_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    emergency_contact_name = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    emergency_contact_relation = EXCLUDED.emergency_contact_relation,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_from_profile ON public.profiles;
CREATE TRIGGER trg_sync_member_from_profile
AFTER INSERT OR UPDATE OF org_id, full_name, email, phone, mobile_phone, home_address, emergency_contact
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_from_profile();

-- Backfill existing org-linked profiles that are missing from members.
INSERT INTO public.members (
  id,
  org_id,
  name,
  status,
  needs,
  phone,
  address,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relation,
  created_by
)
SELECT
  p.id,
  p.org_id,
  COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(p.email, ''), 'Member') AS name,
  'UNKNOWN'::member_status,
  ARRAY[]::TEXT[] AS needs,
  COALESCE(p.phone, p.mobile_phone) AS phone,
  p.home_address,
  p.emergency_contact->>'name',
  p.emergency_contact->>'phone',
  p.emergency_contact->>'relation',
  p.id
FROM public.profiles p
WHERE p.org_id IS NOT NULL
ON CONFLICT (id)
DO UPDATE SET
  org_id = EXCLUDED.org_id,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  emergency_contact_name = EXCLUDED.emergency_contact_name,
  emergency_contact_phone = EXCLUDED.emergency_contact_phone,
  emergency_contact_relation = EXCLUDED.emergency_contact_relation,
  updated_at = NOW();
