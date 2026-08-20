-- Keep the known CH-9921 directory record internally consistent. Its formatted
-- address is the source already shown to members and App Review.
UPDATE public.organizations
SET city = 'Washington',
    state = 'DC',
    zip_code = '20006',
    updated_at = now()
WHERE org_code = 'CH-9921'
  AND trim(coalesce(address, '')) = '430 17th Street, NW, Washington, DC 20006';

-- Apply all structured organization-location fields when a newly approved
-- member does not yet have a usable home address. A malformed ZIP also counts
-- as an incomplete location. Existing complete personal addresses are kept.
CREATE OR REPLACE FUNCTION public.apply_organization_location_to_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.status = 'active' AND old.status IS DISTINCT FROM 'active' THEN
    UPDATE public.profiles p
    SET
      home_address = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN nullif(trim(o.address), '') ELSE p.home_address END,
      address_line_1 = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN nullif(trim(o.address), '') ELSE p.address_line_1 END,
      address_line_2 = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN null ELSE p.address_line_2 END,
      city = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN nullif(trim(o.city), '') ELSE p.city END,
      state = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN nullif(trim(o.state), '') ELSE p.state END,
      zip = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN nullif(trim(o.zip_code), '') ELSE p.zip END,
      latitude = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN o.latitude ELSE coalesce(p.latitude, o.latitude) END,
      longitude = CASE WHEN (
        (nullif(trim(p.home_address), '') IS NULL AND nullif(trim(p.address_line_1), '') IS NULL)
        OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
      ) THEN o.longitude ELSE coalesce(p.longitude, o.longitude) END,
      org_id = new.organization_id
    FROM public.organizations o
    WHERE p.id = new.user_id
      AND o.id = new.organization_id;
  END IF;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_organization_location_to_member() FROM public, anon, authenticated;

-- Repair already-active memberships whose profiles still have missing or
-- malformed location data, including the NG-1001 review/demo member.
-- Some legacy connections store the organization directly on profiles without
-- a matching memberships row, so repair those profiles first.
UPDATE public.profiles p
SET home_address = nullif(trim(o.address), ''),
    address_line_1 = nullif(trim(o.address), ''),
    address_line_2 = null,
    city = nullif(trim(o.city), ''),
    state = nullif(trim(o.state), ''),
    zip = nullif(trim(o.zip_code), ''),
    latitude = o.latitude,
    longitude = o.longitude
FROM public.organizations o
WHERE o.id = p.org_id
  AND (
    (
      nullif(trim(p.home_address), '') IS NULL
      AND nullif(trim(p.address_line_1), '') IS NULL
    )
    OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
  );

UPDATE public.profiles p
SET home_address = nullif(trim(o.address), ''),
    address_line_1 = nullif(trim(o.address), ''),
    address_line_2 = null,
    city = nullif(trim(o.city), ''),
    state = nullif(trim(o.state), ''),
    zip = nullif(trim(o.zip_code), ''),
    latitude = o.latitude,
    longitude = o.longitude,
    org_id = m.organization_id
FROM public.memberships m
JOIN public.organizations o ON o.id = m.organization_id
WHERE m.user_id = p.id
  AND m.status = 'active'
  AND (
    (
      nullif(trim(p.home_address), '') IS NULL
      AND nullif(trim(p.address_line_1), '') IS NULL
    )
    OR coalesce(trim(p.zip), '') !~ '^\d{5}(-\d{4})?$'
  );
