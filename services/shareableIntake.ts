import { supabase } from './supabaseClient';

export interface ShareableIntakeLink {
  id: string;
  user_id: string;
  referrer_name: string;
  organization_name?: string;
  share_token: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  submission_count: number;
}

export interface ShareableIntakeLinkInput {
  referrer_name: string;
  organization_name?: string;
  expiresInDays?: number;
}

/**
 * Create a new shareable intake link for authenticated user
 */
export async function createShareableIntakeLink(
  input: ShareableIntakeLinkInput
): Promise<ShareableIntakeLink> {
  const { referrer_name, organization_name, expiresInDays } = input;

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('shareable_intake_links')
    .insert([
      {
        referrer_name,
        organization_name,
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all shareable links created by current user
 */
export async function getUserShareableIntakeLinks(): Promise<ShareableIntakeLink[]> {
  const { data, error } = await supabase
    .from('shareable_intake_links')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a shareable link by token (public access)
 */
export async function getShareableIntakeLinkByToken(
  shareToken: string
): Promise<ShareableIntakeLink | null> {
  const { data, error } = await supabase
    .from('shareable_intake_links')
    .select('*')
    .eq('share_token', shareToken)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  if (!data) return null;

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data;
}

/**
 * Deactivate a shareable link
 */
export async function deactivateShareableIntakeLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('shareable_intake_links')
    .update({ is_active: false })
    .eq('id', linkId);

  if (error) throw error;
}

/**
 * Increment submission count for a link
 */
export async function incrementShareableLinkSubmissionCount(
  shareToken: string
): Promise<void> {
  const { error } = await supabase.rpc('increment_shareable_link_count', {
    token: shareToken,
  });

  if (error) throw error;
}

/**
 * Get the public share URL for a link
 */
export function getPublicShareUrl(shareToken: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/public/intake?share_token=${shareToken}`;
}

export interface PublicLeadIntakeInput {
  shareToken: string;
  applicantName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  caseType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  consentToContact: boolean;
  tcpaComplianceAcknowledged: boolean;
  privacyPolicyAccepted: boolean;
  notes?: string;
}

export interface PublicLeadSubmitResult {
  id: string;
  external_lead_id: string;
  applicant_name: string;
  city: string;
  state: string;
  case_type: string;
  status: string;
  created_at: string;
}

export async function submitPublicLeadIntake(input: PublicLeadIntakeInput): Promise<PublicLeadSubmitResult> {
  const { data, error } = await supabase.rpc('submit_public_lead_intake', {
    share_token_input: input.shareToken,
    applicant_name_input: input.applicantName,
    phone_input: input.phone,
    email_input: input.email,
    city_input: input.city,
    state_input: input.state,
    zip_code_input: input.zipCode,
    case_type_input: input.caseType,
    severity_input: input.severity,
    consent_to_contact_input: input.consentToContact,
    tcpa_compliance_acknowledged_input: input.tcpaComplianceAcknowledged,
    privacy_policy_accepted_input: input.privacyPolicyAccepted,
    notes_input: input.notes || null,
    channel_input: 'WEB',
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Failed to submit intake');

  return data[0] as PublicLeadSubmitResult;
}
