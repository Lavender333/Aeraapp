-- Add support for shareable referral intake forms
-- Allows authenticated users to generate public links that pre-fill their info

CREATE TABLE IF NOT EXISTS public.shareable_intake_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_name TEXT NOT NULL,
  organization_name TEXT,
  share_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  submission_count INTEGER DEFAULT 0
);

-- Index on share_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_shareable_intake_links_token ON public.shareable_intake_links(share_token);
CREATE INDEX IF NOT EXISTS idx_shareable_intake_links_user_id ON public.shareable_intake_links(user_id);

-- Enable RLS
ALTER TABLE public.shareable_intake_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own shareable links
DROP POLICY IF EXISTS shareable_intake_links_select_policy ON public.shareable_intake_links;
CREATE POLICY shareable_intake_links_select_policy
  ON public.shareable_intake_links FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: Public can read active, non-expired links by token lookup
DROP POLICY IF EXISTS shareable_intake_links_public_select_policy ON public.shareable_intake_links;
CREATE POLICY shareable_intake_links_public_select_policy
  ON public.shareable_intake_links FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Policy: Users can create shareable links
DROP POLICY IF EXISTS shareable_intake_links_insert_policy ON public.shareable_intake_links;
CREATE POLICY shareable_intake_links_insert_policy
  ON public.shareable_intake_links FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own links
DROP POLICY IF EXISTS shareable_intake_links_update_policy ON public.shareable_intake_links;
CREATE POLICY shareable_intake_links_update_policy
  ON public.shareable_intake_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own links
DROP POLICY IF EXISTS shareable_intake_links_delete_policy ON public.shareable_intake_links;
CREATE POLICY shareable_intake_links_delete_policy
  ON public.shareable_intake_links FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shareable_intake_links TO authenticated;
GRANT SELECT ON public.shareable_intake_links TO anon;

-- Create function to increment submission count
CREATE OR REPLACE FUNCTION public.increment_shareable_link_count(token TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.shareable_intake_links
  SET submission_count = submission_count + 1
  WHERE share_token = token;
$$;

GRANT EXECUTE ON FUNCTION public.increment_shareable_link_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_shareable_link_count(TEXT) TO anon;

-- Public submission function so unregistered users can submit via shared links
CREATE OR REPLACE FUNCTION public.submit_public_lead_intake(
  share_token_input TEXT,
  applicant_name_input TEXT,
  phone_input TEXT,
  email_input TEXT,
  city_input TEXT,
  state_input TEXT,
  zip_code_input TEXT,
  case_type_input TEXT,
  severity_input TEXT,
  consent_to_contact_input BOOLEAN,
  tcpa_compliance_acknowledged_input BOOLEAN,
  privacy_policy_accepted_input BOOLEAN,
  notes_input TEXT DEFAULT NULL,
  channel_input TEXT DEFAULT 'WEB'
)
RETURNS TABLE (
  id UUID,
  external_lead_id TEXT,
  applicant_name TEXT,
  city TEXT,
  state TEXT,
  case_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_row public.shareable_intake_links;
  lead_row public.verified_leads;
BEGIN
  SELECT * INTO link_row
  FROM public.shareable_intake_links
  WHERE share_token = share_token_input
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF link_row.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share token';
  END IF;

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
    applicant_name_input,
    phone_input,
    NULLIF(email_input, ''),
    city_input,
    UPPER(state_input),
    zip_code_input,
    consent_to_contact_input,
    NOW(),
    tcpa_compliance_acknowledged_input,
    privacy_policy_accepted_input,
    LENGTH(REGEXP_REPLACE(COALESCE(phone_input, ''), '\\D', '', 'g')) >= 10,
    (email_input IS NOT NULL AND email_input <> ''),
    85,
    true,
    false,
    true,
    82,
    'B',
    UPPER(COALESCE(severity_input, 'LOW')),
    COALESCE(case_type_input, 'Property Claim'),
    'NEW',
    NULLIF(notes_input, ''),
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

GRANT EXECUTE ON FUNCTION public.submit_public_lead_intake(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_lead_intake(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO authenticated;
