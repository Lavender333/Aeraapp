-- Harden public intake RLS and RPC security
-- Fixes three production blockers identified in readiness audit:
--   1. Anon SELECT policy allowed full-table enumeration of share tokens
--   2. Anon could call increment_shareable_link_count directly (analytics skew)
--   3. submit_public_lead_intake had no input validation or rate limiting

-- ============================================================
-- FIX 1: Remove anon SELECT policy + revoke direct table access
-- ============================================================

DROP POLICY IF EXISTS shareable_intake_links_public_select_policy ON public.shareable_intake_links;
REVOKE SELECT ON public.shareable_intake_links FROM anon;

-- ============================================================
-- FIX 2: Revoke anon access to increment function
-- (increment is already handled inside submit_public_lead_intake)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.increment_shareable_link_count(TEXT) FROM anon;

-- ============================================================
-- FIX 3: Token-scoped lookup function (replaces direct table query)
-- Anon can resolve only the display fields for an exact known token.
-- No row list is ever returned, so enumeration is impossible.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_intake_link_by_token(token_input TEXT)
RETURNS TABLE (
  referrer_name     TEXT,
  organization_name TEXT,
  is_valid          BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      l.referrer_name,
      l.organization_name,
      TRUE AS is_valid
    FROM public.shareable_intake_links l
    WHERE l.share_token = token_input
      AND l.is_active = TRUE
      AND (l.expires_at IS NULL OR l.expires_at > NOW())
    LIMIT 1;

  -- If no matching token, return an explicit invalid marker row
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, FALSE::BOOLEAN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_intake_link_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_intake_link_by_token(TEXT) TO authenticated;

-- ============================================================
-- FIX 4: Harden submit_public_lead_intake
--   - Add required-field validation
--   - Add phone digit range check
--   - Add consent gate (all three flags required)
--   - Add per-token-owner rate limit: max 20 submissions / hour
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_public_lead_intake(
  share_token_input                   TEXT,
  applicant_name_input                TEXT,
  phone_input                         TEXT,
  email_input                         TEXT,
  city_input                          TEXT,
  state_input                         TEXT,
  zip_code_input                      TEXT,
  case_type_input                     TEXT,
  severity_input                      TEXT,
  consent_to_contact_input            BOOLEAN,
  tcpa_compliance_acknowledged_input  BOOLEAN,
  privacy_policy_accepted_input       BOOLEAN,
  notes_input                         TEXT DEFAULT NULL,
  channel_input                       TEXT DEFAULT 'WEB'
)
RETURNS TABLE (
  id               UUID,
  external_lead_id TEXT,
  applicant_name   TEXT,
  city             TEXT,
  state            TEXT,
  case_type        TEXT,
  status           TEXT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row      public.shareable_intake_links;
  lead_row      public.verified_leads;
  recent_count  INTEGER;
  digits_only   TEXT;
BEGIN
  -- ── Input validation ────────────────────────────────────────

  IF LENGTH(TRIM(COALESCE(applicant_name_input, ''))) < 2 THEN
    RAISE EXCEPTION 'Applicant name is required';
  END IF;

  digits_only := REGEXP_REPLACE(COALESCE(phone_input, ''), '\D', '', 'g');
  IF LENGTH(digits_only) < 10 OR LENGTH(digits_only) > 15 THEN
    RAISE EXCEPTION 'A valid phone number is required (10–15 digits)';
  END IF;

  IF LENGTH(TRIM(COALESCE(city_input, ''))) < 1 THEN
    RAISE EXCEPTION 'City is required';
  END IF;

  IF LENGTH(TRIM(COALESCE(state_input, ''))) < 2 THEN
    RAISE EXCEPTION 'State is required';
  END IF;

  IF NOT COALESCE(consent_to_contact_input, false) THEN
    RAISE EXCEPTION 'Consent to contact is required';
  END IF;

  IF NOT COALESCE(tcpa_compliance_acknowledged_input, false) THEN
    RAISE EXCEPTION 'TCPA compliance must be acknowledged';
  END IF;

  IF NOT COALESCE(privacy_policy_accepted_input, false) THEN
    RAISE EXCEPTION 'Privacy policy must be accepted';
  END IF;

  -- ── Validate share token ────────────────────────────────────

  SELECT * INTO link_row
  FROM public.shareable_intake_links
  WHERE share_token = share_token_input
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF link_row.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share token';
  END IF;

  -- ── Rate limit: max 20 submissions per link owner per hour ──

  SELECT COUNT(*) INTO recent_count
  FROM public.verified_leads
  WHERE submitted_by = link_row.user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Too many submissions in the last hour. Please try again later.';
  END IF;

  -- ── Insert verified lead ─────────────────────────────────────

  INSERT INTO public.verified_leads (
    external_lead_id,
    source_tag,
    channel,
    applicant_name,
    phone,
    email,
    city,
    state,
    zip_code,
    consent_to_contact,
    consent_timestamp,
    tcpa_compliance_acknowledged,
    privacy_policy_accepted,
    phone_verified,
    email_verified,
    identity_score,
    duplicate_checked,
    fraud_flagged,
    service_area_match,
    quality_score,
    tier,
    severity,
    case_type,
    status,
    notes,
    submitted_by
  )
  VALUES (
    'LEAD-' || RIGHT(CAST(FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000) AS TEXT), 5),
    'shared-by-' || link_row.user_id::text,
    UPPER(COALESCE(channel_input, 'WEB')),
    TRIM(applicant_name_input),
    digits_only,
    NULLIF(TRIM(COALESCE(email_input, '')), ''),
    TRIM(city_input),
    UPPER(TRIM(state_input)),
    NULLIF(TRIM(COALESCE(zip_code_input, '')), ''),
    consent_to_contact_input,
    NOW(),
    tcpa_compliance_acknowledged_input,
    privacy_policy_accepted_input,
    LENGTH(digits_only) >= 10,
    (email_input IS NOT NULL AND TRIM(email_input) <> ''),
    85,
    true,
    false,
    true,
    82,
    'B',
    UPPER(COALESCE(severity_input, 'LOW')),
    COALESCE(case_type_input, 'Property Claim'),
    'NEW',
    NULLIF(TRIM(COALESCE(notes_input, '')), ''),
    link_row.user_id
  )
  RETURNING * INTO lead_row;

  UPDATE public.shareable_intake_links
  SET submission_count = submission_count + 1
  WHERE id = link_row.id;

  RETURN QUERY
  SELECT
    lead_row.id,
    lead_row.external_lead_id,
    lead_row.applicant_name,
    lead_row.city,
    lead_row.state,
    lead_row.case_type,
    lead_row.status,
    lead_row.created_at;
END;
$$;

-- Re-grant execute (CREATE OR REPLACE preserves grants, but be explicit)
GRANT EXECUTE ON FUNCTION public.submit_public_lead_intake(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_lead_intake(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO authenticated;
