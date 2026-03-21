/**
 * AERA Event Distribution & Outreach Service
 * Handles event setup, participant registration, QR/code generation,
 * supply tracking, check-ins, and geofenced outreach consent.
 */

import { supabase } from './supabase';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type EventStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SupplyType = 'FOOD_BOX' | 'WATER' | 'HYGIENE_KIT' | 'BABY_SUPPLIES' | 'OTHER';
export type CheckInStatus = 'NO_RESPONSE' | 'SAFE' | 'NEEDS_HELP';

export interface DistributionEventSession {
  id: string;
  event_id: string;
  session_name: string;
  start_at: string;
  end_at: string | null;
  registration_open_at: string | null;
  registration_close_at: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  max_registrants: number | null;
  status: EventStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DistributionEvent {
  id: string;
  organization_id: string | null;
  name: string;
  distribution_date: string;
  distribution_time: string | null;
  location_name: string | null;
  max_registrants: number | null;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  event_notes: string | null;
  latitude: number | null;
  longitude: number | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  timezone?: string | null;
  sessions?: DistributionEventSession[];
}

export interface EventSupplyItem {
  id: string;
  event_id: string;
  supply_type: SupplyType;
  supply_label: string;
  unit_type: string;
  pack_size: number;
  starting_count: number;
  current_count: number;
  low_stock_threshold: number;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  session_id: string;
  profile_id: string | null;
  ticket_id: string;
  participant_code: string;
  full_name: string;
  household_size: number;
  additional_members: number;
  free_member_limit: number;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  contact_preference: 'SMS' | 'CALL' | 'EMAIL' | string;
  pickup_after_time: string | null;
  proxy_pickup: boolean;
  urgency_tier: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  delivery_barrier: string | null;
  children_count: number;
  seniors_count: number;
  disability_present: boolean;
  preferred_language: string;
  consent_version: string | null;
  consent_channel: string;
  geocode_confidence: number | null;
  geocoded_at: string | null;
  served: boolean;
  served_at: string | null;
  served_by: string | null;
  admin_override: boolean;
  check_in_status: CheckInStatus;
  check_in_at: string | null;
  outreach_opt_in: boolean;
  outreach_radius_miles: number;
  latitude: number | null;
  longitude: number | null;
  consent_timestamp: string | null;
  requested_supplies: Array<{ supply_item_id: string; supply_label: string; quantity: number }>;
  created_at: string;
}

export interface EventDistributionLog {
  id: string;
  event_id: string;
  session_id: string;
  registration_id: string;
  supply_item_id: string | null;
  quantity: number;
  distributed_at: string;
  distributed_by: string | null;
  notes: string | null;
}

export interface ScanResult {
  registration: EventRegistration;
  supplies: EventSupplyItem[];
  alreadyServed: boolean;
}

export interface CreateEventSessionInput {
  session_name: string;
  start_at: string;
  end_at?: string | null;
  registration_open_at?: string | null;
  registration_close_at?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  max_registrants?: number | null;
  status?: EventStatus;
  sort_order?: number;
}

export interface CreateEventInput {
  organization_id: string | null;
  name: string;
  event_notes?: string | null;
  timezone?: string | null;
  status: EventStatus;
  created_by?: string | null;
  sessions: CreateEventSessionInput[];
}

export interface UpdateEventSessionInput extends CreateEventSessionInput {
  id?: string;
}

export interface UpdateEventInput {
  eventId: string;
  name: string;
  event_notes?: string | null;
  timezone?: string | null;
  status?: EventStatus;
  sessions: UpdateEventSessionInput[];
}

export interface UpdateSupplyItemInput {
  id?: string;
  supply_type: SupplyType;
  supply_label: string;
  unit_type: string;
  pack_size: number;
  starting_count: number;
  low_stock_threshold: number;
}

// ─────────────────────────────────────────
// Code / ID generators (pure functions, no crypto dep needed)
// ─────────────────────────────────────────

/** Generates a random 4-digit string (padded) unique per event. */
export function generateParticipantCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Generates a human-readable ticket ID.
 * Format: <SUPPLY_PREFIX><MMYY>-<4-digit code>
 * e.g.  FOOD0317-4827
 */
export function generateTicketId(eventName: string, participantCode: string): string {
  const prefix = eventName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X');
  const now = new Date();
  const mmyy = String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear()).slice(-2);
  return `${prefix}${mmyy}-${participantCode}`;
}

// ─────────────────────────────────────────
// Household validation
// ─────────────────────────────────────────

export const FREE_HOUSEHOLD_LIMIT = 2; // additional members beyond primary

function sortSessions(sessions: DistributionEventSession[]): DistributionEventSession[] {
  return [...sessions].sort((left, right) => {
    const orderDelta = Number(left.sort_order || 0) - Number(right.sort_order || 0);
    if (orderDelta !== 0) return orderDelta;
    return new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
  });
}

function toLegacyEventFields(session: CreateEventSessionInput) {
  const start = new Date(session.start_at);
  const regOpen = session.registration_open_at ? new Date(session.registration_open_at) : null;
  const regClose = session.registration_close_at ? new Date(session.registration_close_at) : null;
  const end = session.end_at ? new Date(session.end_at) : null;
  const pad = (value: number) => String(value).padStart(2, '0');
  const toTimeString = (date: Date | null) =>
    date ? `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}` : null;

  return {
    distribution_date: start.toISOString().slice(0, 10),
    distribution_time: toTimeString(start),
    pickup_window_start: toTimeString(regOpen),
    pickup_window_end: toTimeString(regClose || end),
    location_name: session.location_name ?? null,
    latitude: session.latitude ?? null,
    longitude: session.longitude ?? null,
    max_registrants: session.max_registrants ?? null,
  };
}

async function fetchSessionsForEventIds(eventIds: string[]): Promise<Record<string, DistributionEventSession[]>> {
  if (eventIds.length === 0) return {};

  const { data, error } = await supabase
    .from('distribution_event_sessions')
    .select('*')
    .in('event_id', eventIds)
    .order('sort_order', { ascending: true })
    .order('start_at', { ascending: true });

  if (error) throw new Error(error.message);

  const grouped: Record<string, DistributionEventSession[]> = {};
  for (const raw of (data ?? []) as DistributionEventSession[]) {
    if (!grouped[raw.event_id]) grouped[raw.event_id] = [];
    grouped[raw.event_id].push(raw);
  }

  for (const eventId of Object.keys(grouped)) {
    grouped[eventId] = sortSessions(grouped[eventId]);
  }

  return grouped;
}

async function hydrateEventsWithSessions(events: DistributionEvent[]): Promise<DistributionEvent[]> {
  const sessionsByEventId = await fetchSessionsForEventIds(events.map((event) => event.id));
  return events.map((event) => ({
    ...event,
    sessions: sessionsByEventId[event.id] ?? [],
  }));
}

export function getEventPrimarySession(event: DistributionEvent | null | undefined): DistributionEventSession | null {
  const sessions = event?.sessions ?? [];
  if (sessions.length === 0) return null;
  return sessions.find((session) => session.status !== 'CANCELLED') ?? sessions[0];
}

export function resolveEventSession(
  event: DistributionEvent | null | undefined,
  sessionId?: string | null
): DistributionEventSession | null {
  if (!event) return null;
  if (sessionId) {
    const matched = (event.sessions ?? []).find((session) => session.id === sessionId);
    if (matched) return matched;
  }
  return getEventPrimarySession(event);
}

export function validateHouseholdSize(additionalMembers: number): {
  valid: boolean;
  requiresAdminApproval: boolean;
  message: string;
} {
  if (additionalMembers <= FREE_HOUSEHOLD_LIMIT) {
    return { valid: true, requiresAdminApproval: false, message: '' };
  }
  return {
    valid: false,
    requiresAdminApproval: true,
    message: `You may add up to ${FREE_HOUSEHOLD_LIMIT} additional household members for free. Additional members require admin approval.`,
  };
}

// ─────────────────────────────────────────
// Events CRUD
// ─────────────────────────────────────────

export async function createEvent(
  data: CreateEventInput
): Promise<DistributionEvent> {
  const primarySession = data.sessions[0];
  if (!primarySession) {
    throw new Error('At least one event session is required.');
  }

  const legacyFields = toLegacyEventFields(primarySession);

  const { data: row, error } = await supabase
    .from('distribution_events')
    .insert({
      organization_id: data.organization_id,
      name: data.name,
      event_notes: data.event_notes ?? null,
      timezone: data.timezone ?? 'UTC',
      status: data.status,
      created_by: data.created_by ?? null,
      ...legacyFields,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const event = row as DistributionEvent;
  const sessionRows = data.sessions.map((session, index) => ({
    event_id: event.id,
    session_name: session.session_name.trim(),
    start_at: session.start_at,
    end_at: session.end_at ?? null,
    registration_open_at: session.registration_open_at ?? null,
    registration_close_at: session.registration_close_at ?? null,
    location_name: session.location_name ?? null,
    latitude: session.latitude ?? null,
    longitude: session.longitude ?? null,
    max_registrants: session.max_registrants ?? null,
    status: session.status ?? data.status,
    sort_order: session.sort_order ?? index,
  }));

  const { error: sessionError } = await supabase
    .from('distribution_event_sessions')
    .insert(sessionRows);

  if (sessionError) throw new Error(sessionError.message);
  return (await getEvent(event.id)) as DistributionEvent;
}

export async function updateEventDetails(
  data: UpdateEventInput
): Promise<DistributionEvent> {
  const primarySession = data.sessions[0];
  if (!primarySession) {
    throw new Error('At least one event session is required.');
  }

  const legacyFields = toLegacyEventFields(primarySession);
  const eventUpdatePayload: Record<string, unknown> = {
    name: data.name,
    event_notes: data.event_notes ?? null,
    timezone: data.timezone ?? 'UTC',
    ...legacyFields,
  };
  if (data.status) {
    eventUpdatePayload.status = data.status;
  }

  const { error } = await supabase
    .from('distribution_events')
    .update(eventUpdatePayload)
    .eq('id', data.eventId);

  if (error) throw new Error(error.message);

  const sessionsPayload = data.sessions.map((session, index) => ({
    event_id: data.eventId,
    session_name: session.session_name.trim(),
    start_at: session.start_at,
    end_at: session.end_at ?? null,
    registration_open_at: session.registration_open_at ?? null,
    registration_close_at: session.registration_close_at ?? null,
    location_name: session.location_name ?? null,
    latitude: session.latitude ?? null,
    longitude: session.longitude ?? null,
    max_registrants: session.max_registrants ?? null,
    status: session.status ?? data.status ?? 'ACTIVE',
    sort_order: session.sort_order ?? index,
  }));

  const newSessions = sessionsPayload.filter((session, index) => !data.sessions[index].id);

  for (let index = 0; index < data.sessions.length; index += 1) {
    const source = data.sessions[index];
    if (!source.id) continue;
    const payload = sessionsPayload[index];
    const { error: sessionError } = await supabase
      .from('distribution_event_sessions')
      .update(payload)
      .eq('id', source.id)
      .eq('event_id', data.eventId);
    if (sessionError) throw new Error(sessionError.message);
  }

  if (newSessions.length > 0) {
    const { error: insertError } = await supabase
      .from('distribution_event_sessions')
      .insert(newSessions);
    if (insertError) throw new Error(insertError.message);
  }

  return (await getEvent(data.eventId)) as DistributionEvent;
}

export async function updateEventSupplyItems(
  eventId: string,
  items: UpdateSupplyItemInput[]
): Promise<EventSupplyItem[]> {
  const existingItems = await getSupplyItems(eventId);
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
  const inputIds = new Set(items.filter((item) => item.id).map((item) => item.id as string));

  for (const item of items) {
    if (item.id) {
      const existing = existingById.get(item.id);
      if (!existing) continue;
      const delta = Math.max(0, item.starting_count) - Math.max(0, existing.starting_count);
      const nextCurrentCount = Math.max(0, Number(existing.current_count || 0) + delta);
      const { error } = await supabase
        .from('event_supply_items')
        .update({
          supply_type: item.supply_type,
          supply_label: item.supply_label,
          unit_type: item.unit_type,
          pack_size: item.pack_size,
          starting_count: item.starting_count,
          current_count: nextCurrentCount,
          low_stock_threshold: item.low_stock_threshold,
        })
        .eq('id', item.id)
        .eq('event_id', eventId);
      if (error) throw new Error(error.message);
      continue;
    }

    const { error } = await supabase
      .from('event_supply_items')
      .insert({
        event_id: eventId,
        supply_type: item.supply_type,
        supply_label: item.supply_label,
        unit_type: item.unit_type,
        pack_size: item.pack_size,
        starting_count: item.starting_count,
        current_count: item.starting_count,
        low_stock_threshold: item.low_stock_threshold,
      });
    if (error) throw new Error(error.message);
  }

  for (const existing of existingItems) {
    if (inputIds.has(existing.id)) continue;
    const { error } = await supabase
      .from('event_supply_items')
      .delete()
      .eq('id', existing.id)
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  }

  return getSupplyItems(eventId);
}

export async function listEvents(organizationId?: string): Promise<DistributionEvent[]> {
  let query = supabase
    .from('distribution_events')
    .select('*')
    .order('distribution_date', { ascending: false });
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return hydrateEventsWithSessions((data ?? []) as DistributionEvent[]);
}

export async function getEvent(eventId: string): Promise<DistributionEvent | null> {
  const { data, error } = await supabase
    .from('distribution_events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (error) return null;
  const [hydrated] = await hydrateEventsWithSessions([data as DistributionEvent]);
  return hydrated ?? null;
}

export async function updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
  const { error } = await supabase
    .from('distribution_events')
    .update({ status })
    .eq('id', eventId);
  if (error) throw new Error(error.message);

  const { error: sessionError } = await supabase
    .from('distribution_event_sessions')
    .update({ status })
    .eq('event_id', eventId);
  if (sessionError) throw new Error(sessionError.message);
}

// ─────────────────────────────────────────
// Supply items
// ─────────────────────────────────────────

export async function upsertSupplyItem(
  item: Omit<EventSupplyItem, 'id'>
): Promise<EventSupplyItem> {
  const { data, error } = await supabase
    .from('event_supply_items')
    .insert({ ...item, current_count: item.starting_count })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EventSupplyItem;
}

export async function getSupplyItems(eventId: string): Promise<EventSupplyItem[]> {
  const { data, error } = await supabase
    .from('event_supply_items')
    .select('*')
    .eq('event_id', eventId)
    .order('supply_label');
  if (error) throw new Error(error.message);
  return (data ?? []) as EventSupplyItem[];
}

export async function deductSupply(
  supplyItemId: string,
  quantity: number
): Promise<void> {
  // Use an RPC or direct update; we do a safe decrement
  const { error } = await supabase.rpc('deduct_supply_count', {
    p_supply_item_id: supplyItemId,
    p_quantity: quantity,
  });
  if (error) {
    // Fallback: fetch current + update
    const { data: item } = await supabase
      .from('event_supply_items')
      .select('current_count')
      .eq('id', supplyItemId)
      .single();
    const newCount = Math.max(0, ((item as EventSupplyItem)?.current_count ?? 0) - quantity);
    await supabase
      .from('event_supply_items')
      .update({ current_count: newCount })
      .eq('id', supplyItemId);
  }
}

// ─────────────────────────────────────────
// Registration
// ─────────────────────────────────────────

/**
 * Ensures participant_code is unique for this event by retrying up to 10 times.
 */
async function generateUniqueCode(eventId: string, eventName: string): Promise<{ code: string; ticketId: string }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateParticipantCode();
    const { count } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('participant_code', code);
    if ((count ?? 0) === 0) {
      return { code, ticketId: generateTicketId(eventName, code) };
    }
  }
  throw new Error('Unable to generate a unique participant code. Please try again.');
}

export interface RegisterParticipantInput {
  eventId: string;
  sessionId: string;
  eventName: string;
  fullName: string;
  householdSize: number;
  additionalMembers: number;
  zipCode?: string;
  phone?: string;
  email?: string;
  contactPreference?: 'SMS' | 'CALL' | 'EMAIL';
  pickupAfterTime?: string;
  proxyPickup?: boolean;
  urgencyTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  deliveryBarrier?: string;
  childrenCount?: number;
  seniorsCount?: number;
  disabilityPresent?: boolean;
  preferredLanguage?: string;
  outreachOptIn?: boolean;
  latitude?: number;
  longitude?: number;
  consentVersion?: string;
  consentChannel?: string;
  geocodeConfidence?: number;
  geocodedAt?: string;
  profileId?: string;
  requestedSupplies?: Array<{ supplyItemId: string; supplyLabel: string; quantity: number }>;
}

function normalizePhone(phone?: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length ? digits : null;
}

function normalizeEmail(email?: string): string | null {
  const cleaned = String(email || '').trim().toLowerCase();
  return cleaned.length ? cleaned : null;
}

async function findExistingRegistration(input: RegisterParticipantInput): Promise<EventRegistration | null> {
  const profileId = input.profileId || null;
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = normalizeEmail(input.email);

  if (profileId) {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', input.eventId)
      .eq('session_id', input.sessionId)
      .eq('profile_id', profileId)
      .maybeSingle();
    if (!error && data) return data as EventRegistration;
  }

  if (normalizedPhone) {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', input.eventId)
      .eq('session_id', input.sessionId)
      .eq('phone', normalizedPhone)
      .maybeSingle();
    if (!error && data) return data as EventRegistration;
  }

  if (normalizedEmail) {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', input.eventId)
      .eq('session_id', input.sessionId)
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (!error && data) return data as EventRegistration;
  }

  return null;
}

export async function registerParticipant(
  input: RegisterParticipantInput
): Promise<EventRegistration> {
  let profileId = input.profileId ?? null;
  if (!profileId) {
    const { data: auth } = await supabase.auth.getUser();
    profileId = auth?.user?.id ?? null;
  }

  const existing = await findExistingRegistration({ ...input, profileId: profileId ?? undefined });

  const normalizedPhone = normalizePhone(input.phone);
  const normalizedEmail = normalizeEmail(input.email);

  if (existing) {
    if (!profileId) {
      // Anonymous users can only keep their original registration; edits require auth.
      return existing;
    }

    const updatePayload = {
      profile_id: existing.profile_id ?? profileId,
      session_id: input.sessionId,
      full_name: input.fullName.trim(),
      household_size: input.householdSize,
      additional_members: input.additionalMembers,
      free_member_limit: FREE_HOUSEHOLD_LIMIT,
      zip_code: input.zipCode ?? null,
      phone: normalizedPhone,
      email: normalizedEmail,
      contact_preference: input.contactPreference ?? 'SMS',
      pickup_after_time: input.pickupAfterTime ?? null,
      proxy_pickup: Boolean(input.proxyPickup),
      urgency_tier: input.urgencyTier ?? 'MEDIUM',
      delivery_barrier: input.deliveryBarrier ?? null,
      children_count: Math.max(0, Math.round(Number(input.childrenCount || 0))),
      seniors_count: Math.max(0, Math.round(Number(input.seniorsCount || 0))),
      disability_present: Boolean(input.disabilityPresent),
      preferred_language: String(input.preferredLanguage || 'en').trim() || 'en',
      consent_version: input.consentVersion ?? null,
      consent_channel: input.consentChannel ?? 'WEB',
      geocode_confidence:
        typeof input.geocodeConfidence === 'number' && Number.isFinite(input.geocodeConfidence)
          ? input.geocodeConfidence
          : null,
      geocoded_at: input.geocodedAt ?? null,
      outreach_opt_in: input.outreachOptIn ?? false,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      consent_timestamp: input.outreachOptIn ? new Date().toISOString() : null,
      requested_supplies: (input.requestedSupplies ?? [])
        .filter((s) => Number(s.quantity) > 0)
        .map((s) => ({
          supply_item_id: s.supplyItemId,
          supply_label: s.supplyLabel,
          quantity: Math.max(1, Math.round(Number(s.quantity))),
        })),
    };

    const { data, error } = await supabase
      .from('event_registrations')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as EventRegistration;
  }

  const { code, ticketId } = await generateUniqueCode(input.eventId, input.eventName);

  const payload = {
    event_id: input.eventId,
    session_id: input.sessionId,
    profile_id: profileId,
    ticket_id: ticketId,
    participant_code: code,
    full_name: input.fullName.trim(),
    household_size: input.householdSize,
    additional_members: input.additionalMembers,
    free_member_limit: FREE_HOUSEHOLD_LIMIT,
    zip_code: input.zipCode ?? null,
    phone: normalizedPhone,
    email: normalizedEmail,
    contact_preference: input.contactPreference ?? 'SMS',
    pickup_after_time: input.pickupAfterTime ?? null,
    proxy_pickup: Boolean(input.proxyPickup),
    urgency_tier: input.urgencyTier ?? 'MEDIUM',
    delivery_barrier: input.deliveryBarrier ?? null,
    children_count: Math.max(0, Math.round(Number(input.childrenCount || 0))),
    seniors_count: Math.max(0, Math.round(Number(input.seniorsCount || 0))),
    disability_present: Boolean(input.disabilityPresent),
    preferred_language: String(input.preferredLanguage || 'en').trim() || 'en',
    consent_version: input.consentVersion ?? null,
    consent_channel: input.consentChannel ?? 'WEB',
    geocode_confidence:
      typeof input.geocodeConfidence === 'number' && Number.isFinite(input.geocodeConfidence)
        ? input.geocodeConfidence
        : null,
    geocoded_at: input.geocodedAt ?? null,
    outreach_opt_in: input.outreachOptIn ?? false,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    consent_timestamp: input.outreachOptIn ? new Date().toISOString() : null,
    requested_supplies: (input.requestedSupplies ?? [])
      .filter((s) => Number(s.quantity) > 0)
      .map((s) => ({
        supply_item_id: s.supplyItemId,
        supply_label: s.supplyLabel,
        quantity: Math.max(1, Math.round(Number(s.quantity))),
      })),
  };

  const { data, error } = await supabase
    .from('event_registrations')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EventRegistration;
}

export interface EventRegistrationWithEvent extends EventRegistration {
  event: DistributionEvent | null;
  session: DistributionEventSession | null;
}

export async function listPublicActiveEvents(): Promise<DistributionEvent[]> {
  const { data, error } = await supabase
    .from('distribution_events')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('distribution_date', { ascending: true });
  if (error) throw new Error(error.message);
  const events = await hydrateEventsWithSessions((data ?? []) as DistributionEvent[]);
  return events.map((event) => ({
    ...event,
    sessions: (event.sessions ?? []).filter((session) => session.status === 'ACTIVE'),
  }));
}

export async function listMyEventRegistrations(profileId?: string): Promise<EventRegistrationWithEvent[]> {
  let resolvedProfileId = profileId;
  if (!resolvedProfileId) {
    const { data: auth } = await supabase.auth.getUser();
    resolvedProfileId = auth?.user?.id;
  }
  if (!resolvedProfileId) return [];

  const { data, error } = await supabase
    .from('event_registrations')
    .select('*, event:distribution_events(*), session:distribution_event_sessions(*)')
    .eq('profile_id', resolvedProfileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const regs = (data ?? []) as EventRegistrationWithEvent[];
  return regs.map((reg) => ({
    ...reg,
    event: reg.event ? { ...reg.event, sessions: reg.session ? [reg.session] : reg.event.sessions ?? [] } : null,
  }));
}

export async function getMyEventRegistration(
  eventId: string,
  profileId?: string,
  sessionId?: string
): Promise<EventRegistration | null> {
  let resolvedProfileId = profileId;
  if (!resolvedProfileId) {
    const { data: auth } = await supabase.auth.getUser();
    resolvedProfileId = auth?.user?.id;
  }
  if (!resolvedProfileId) return null;

  let query = supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('profile_id', resolvedProfileId);

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

  if (error) throw new Error(error.message);
  return ((data ?? [])[0] ?? null) as EventRegistration | null;
}

// ─────────────────────────────────────────
// Scan & Distribution
// ─────────────────────────────────────────

/** Parse QR payload: "eventId:participantCode" or "eventId:sessionId:participantCode" */
export function parseQrPayload(raw: string): { eventId: string; sessionId?: string; participantCode: string } | null {
  const parts = raw.split(':');
  if (parts.length === 2) {
    const [eventId, participantCode] = parts;
    if (!eventId || !participantCode) return null;
    return { eventId, participantCode };
  }
  if (parts.length === 3) {
    const [eventId, sessionId, participantCode] = parts;
    if (!eventId || !sessionId || !participantCode) return null;
    return { eventId, sessionId, participantCode };
  }
  return null;
}

export async function lookupByCode(
  eventId: string,
  participantCode: string,
  sessionId?: string
): Promise<ScanResult | null> {
  const cleanCode = participantCode.replace(/\D/g, '').slice(0, 4).padStart(4, '0');
  let query = supabase
    .from('event_registrations')
    .select('*')
    .eq('event_id', eventId)
    .eq('participant_code', cleanCode);

  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query.limit(1);
  const reg = (data ?? [])[0] as EventRegistration | undefined;
  if (error || !reg) return null;
  if (sessionId && reg.session_id !== sessionId) return null;
  const supplies = await getSupplyItems(eventId);
  return {
    registration: reg,
    supplies,
    alreadyServed: reg.served,
  };
}

export async function lookupByQr(
  rawQr: string,
  expectedEventId?: string,
  expectedSessionId?: string
): Promise<ScanResult | null> {
  const parsed = parseQrPayload(rawQr);
  if (!parsed) return null;
  if (expectedEventId && parsed.eventId !== expectedEventId) return null;
  if (expectedSessionId && parsed.sessionId && parsed.sessionId !== expectedSessionId) return null;
  return lookupByCode(parsed.eventId, parsed.participantCode, parsed.sessionId ?? expectedSessionId);
}

export interface RecordDistributionInput {
  eventId: string;
  sessionId: string;
  registrationId: string;
  supplyItems: Array<{ supplyItemId: string; quantity: number }>;
  distributedBy?: string;
  adminOverride?: boolean;
  notes?: string;
}

export async function recordDistribution(input: RecordDistributionInput): Promise<void> {
  // 1. Insert distribution log rows
  const logRows = input.supplyItems.map((s) => ({
    event_id: input.eventId,
    session_id: input.sessionId,
    registration_id: input.registrationId,
    supply_item_id: s.supplyItemId,
    quantity: s.quantity,
    distributed_by: input.distributedBy ?? null,
    notes: input.notes ?? null,
  }));
  if (logRows.length > 0) {
    const { error: logError } = await supabase.from('event_distribution_logs').insert(logRows);
    if (logError) throw new Error(logError.message);
  }

  // 2. Deduct each supply item
  for (const s of input.supplyItems) {
    await deductSupply(s.supplyItemId, s.quantity);
  }

  // 3. Mark registration as served
  const { error: regError } = await supabase
    .from('event_registrations')
    .update({
      served: true,
      served_at: new Date().toISOString(),
      served_by: input.distributedBy ?? null,
      admin_override: input.adminOverride ?? false,
    })
    .eq('id', input.registrationId);
  if (regError) throw new Error(regError.message);
}

// ─────────────────────────────────────────
// Check-in system
// ─────────────────────────────────────────

export async function updateCheckIn(
  registrationId: string,
  status: CheckInStatus
): Promise<void> {
  const { error } = await supabase
    .from('event_registrations')
    .update({
      check_in_status: status,
      check_in_at: new Date().toISOString(),
    })
    .eq('id', registrationId);
  if (error) throw new Error(error.message);

  // Auto-create help_request for NEEDS_HELP
  if (status === 'NEEDS_HELP') {
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('event_id, full_name, phone')
      .eq('id', registrationId)
      .single();
    if (reg) {
      await supabase.from('help_requests').insert({
        source: 'EVENT_CHECK_IN',
        situation_description: `Event check-in: ${reg.full_name} reported needing help.`,
        status: 'PENDING',
        priority: 'HIGH',
        is_safe: false,
      });
    }
  }
}

// ─────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────

export interface EventStats {
  sessionId?: string;
  householdsServed: number;
  peopleServed: number;
  suppliesDistributed: number;
  registrations: number;
  checkInSafe: number;
  checkInNeedsHelp: number;
  checkInNoResponse: number;
  supplyItems: EventSupplyItem[];
  requestedSupplySummary: Array<{
    supply_item_id: string;
    supply_label: string;
    requested_quantity: number;
    requesting_households: number;
    distributed_quantity: number;
    remaining_demand: number;
    available_now: number;
  }>;
}

export async function getEventStats(eventId: string, sessionId?: string): Promise<EventStats> {
  let regsQuery = supabase.from('event_registrations').select('*').eq('event_id', eventId);
  let logsQuery = supabase.from('event_distribution_logs').select('quantity, supply_item_id').eq('event_id', eventId);
  if (sessionId) {
    regsQuery = regsQuery.eq('session_id', sessionId);
    logsQuery = logsQuery.eq('session_id', sessionId);
  }

  const [{ data: regs }, { data: logs }, supplyItems] = await Promise.all([
    regsQuery,
    logsQuery,
    getSupplyItems(eventId),
  ]);

  const allRegs = (regs ?? []) as EventRegistration[];
  const servedRegs = allRegs.filter((r) => r.served);
  const logRows = (logs ?? []) as Array<{ quantity: number; supply_item_id: string | null }>;

  const bySupplyItem = new Map<
    string,
    {
      supply_item_id: string;
      supply_label: string;
      requested_quantity: number;
      requesting_households: number;
      distributed_quantity: number;
      remaining_demand: number;
      available_now: number;
    }
  >();

  for (const item of supplyItems) {
    bySupplyItem.set(item.id, {
      supply_item_id: item.id,
      supply_label: item.supply_label,
      requested_quantity: 0,
      requesting_households: 0,
      distributed_quantity: 0,
      remaining_demand: 0,
      available_now: Number(item.current_count || 0),
    });
  }

  for (const reg of allRegs) {
    const requested = Array.isArray(reg.requested_supplies) ? reg.requested_supplies : [];
    const seenInHousehold = new Set<string>();

    for (const request of requested) {
      const supplyItemId = String(request?.supply_item_id || '').trim();
      if (!supplyItemId) continue;

      const quantity = Math.max(0, Math.round(Number(request?.quantity || 0)));
      if (quantity <= 0) continue;

      const current = bySupplyItem.get(supplyItemId) || {
        supply_item_id: supplyItemId,
        supply_label: String(request?.supply_label || 'Requested Item'),
        requested_quantity: 0,
        requesting_households: 0,
        distributed_quantity: 0,
        remaining_demand: 0,
        available_now: 0,
      };

      current.requested_quantity += quantity;
      if (!seenInHousehold.has(supplyItemId)) {
        current.requesting_households += 1;
        seenInHousehold.add(supplyItemId);
      }
      bySupplyItem.set(supplyItemId, current);
    }
  }

  for (const logRow of logRows) {
    const supplyItemId = String(logRow?.supply_item_id || '').trim();
    if (!supplyItemId) continue;
    const current = bySupplyItem.get(supplyItemId);
    if (!current) continue;
    current.distributed_quantity += Math.max(0, Number(logRow?.quantity || 0));
    bySupplyItem.set(supplyItemId, current);
  }

  const requestedSupplySummary = Array.from(bySupplyItem.values())
    .map((row) => ({
      ...row,
      remaining_demand: Math.max(0, row.requested_quantity - row.distributed_quantity),
    }))
    .filter((row) => row.requested_quantity > 0 || row.distributed_quantity > 0)
    .sort((a, b) => b.requested_quantity - a.requested_quantity);

  return {
    sessionId,
    registrations: allRegs.length,
    householdsServed: servedRegs.length,
    peopleServed: servedRegs.reduce((sum, r) => sum + r.household_size, 0),
    suppliesDistributed: logRows.reduce(
      (sum: number, l: { quantity: number }) => sum + l.quantity,
      0
    ),
    checkInSafe: allRegs.filter((r) => r.check_in_status === 'SAFE').length,
    checkInNeedsHelp: allRegs.filter((r) => r.check_in_status === 'NEEDS_HELP').length,
    checkInNoResponse: allRegs.filter((r) => r.check_in_status === 'NO_RESPONSE').length,
    supplyItems,
    requestedSupplySummary,
  };
}

// ─────────────────────────────────────────
// Geofenced outreach helpers
// ─────────────────────────────────────────

/** Haversine distance in miles between two lat/lng points */
function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // Earth radius miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getOutreachContacts(
  orgLat: number,
  orgLng: number,
  radiusMiles: number = 5
): Promise<EventRegistration[]> {
  // Fetch all opted-in registrations with location, then filter client-side
  const { data, error } = await supabase
    .from('event_registrations')
    .select('*')
    .eq('outreach_opt_in', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  if (error) throw new Error(error.message);
  const regs = (data ?? []) as EventRegistration[];
  return regs.filter((r) => {
    if (r.latitude == null || r.longitude == null) return false;
    const dist = haversineDistanceMiles(orgLat, orgLng, r.latitude, r.longitude);
    return dist <= (r.outreach_radius_miles ?? radiusMiles);
  });
}

// ─────────────────────────────────────────
// QR code data URL (using the qrcode npm package)
// ─────────────────────────────────────────

export async function generateQrDataUrl(payload: string): Promise<string> {
  // Dynamic import so this only loads when needed
  const QRCode = await import('qrcode');
  return QRCode.default.toDataURL(payload, { width: 256, margin: 2 });
}

export function buildQrPayload(eventId: string, participantCode: string, sessionId?: string): string {
  return sessionId ? `${eventId}:${sessionId}:${participantCode}` : `${eventId}:${participantCode}`;
}

// ─────────────────────────────────────────
// Post-event report
// ─────────────────────────────────────────

export interface EventReport {
  event: DistributionEvent;
  session: DistributionEventSession | null;
  stats: EventStats;
  registrations: EventRegistration[];
}

export interface OrgOutreachCandidate {
  profile_id: string;
  full_name: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

export type OutreachContactMethod = 'PHONE_CALL' | 'EMAIL' | 'MANUAL_OUTREACH';

export interface OrgOutreachAuditLog {
  id: string;
  organization_id: string;
  leader_profile_id: string;
  target_profile_id: string;
  target_name: string;
  target_phone: string | null;
  target_email: string | null;
  contact_method: OutreachContactMethod;
  distance_miles: number | null;
  notes: string | null;
  created_at: string;
}

export async function generateEventReport(eventId: string, sessionId?: string): Promise<EventReport> {
  const [event, stats, { data: regs }] = await Promise.all([
    getEvent(eventId),
    getEventStats(eventId, sessionId),
    (sessionId
      ? supabase.from('event_registrations').select('*').eq('event_id', eventId).eq('session_id', sessionId).order('created_at')
      : supabase.from('event_registrations').select('*').eq('event_id', eventId).order('created_at')),
  ]);
  if (!event) throw new Error('Event not found');
  const session = resolveEventSession(event, sessionId);
  return {
    event,
    session,
    stats,
    registrations: (regs ?? []) as EventRegistration[],
  };
}

export async function getOrgLeaderOutreachCandidates(
  organizationId?: string,
  radiusMiles: number = 3
): Promise<OrgOutreachCandidate[]> {
  const { data, error } = await supabase.rpc('get_org_outreach_candidates', {
    p_org_id: organizationId ?? null,
    p_radius_miles: radiusMiles,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as OrgOutreachCandidate[];
}

export async function listOrgOutreachAuditLogs(
  organizationId: string,
  limit: number = 20
): Promise<OrgOutreachAuditLog[]> {
  const { data, error } = await supabase
    .from('org_outreach_audit_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as OrgOutreachAuditLog[];
}

export async function logOrgOutreachContact(input: {
  organizationId: string;
  targetProfileId: string;
  targetName: string;
  targetPhone?: string | null;
  targetEmail?: string | null;
  contactMethod: OutreachContactMethod;
  distanceMiles?: number | null;
  notes?: string;
}): Promise<OrgOutreachAuditLog> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('Not authenticated');

  const payload = {
    organization_id: input.organizationId,
    leader_profile_id: auth.user.id,
    target_profile_id: input.targetProfileId,
    target_name: input.targetName,
    target_phone: input.targetPhone ?? null,
    target_email: input.targetEmail ?? null,
    contact_method: input.contactMethod,
    distance_miles: input.distanceMiles ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('org_outreach_audit_logs')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as OrgOutreachAuditLog;
}
