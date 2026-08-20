import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildEventRegistrationLink,
  buildQrPayload,
  DEFAULT_EVENT_REGISTRATION_BASE_URL,
  isRegistrationSessionAvailable,
  parseQrPayload,
} from '../services/eventDistribution';

describe('event setup QR links', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the live AERA domain outside a browser', () => {
    expect(DEFAULT_EVENT_REGISTRATION_BASE_URL).toBe('https://getaeraapp.com/');
    expect(buildEventRegistrationLink('event-123')).toBe(
      'https://getaeraapp.com/?event=event-123',
    );
  });

  it('uses a clean public root URL instead of the administrator page', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://getaeraapp.com',
        href: 'https://getaeraapp.com/admin/events?tab=setup#private',
      },
    });

    expect(buildEventRegistrationLink('event-456', 'session-2')).toBe(
      'https://getaeraapp.com/?event=event-456&session=session-2',
    );
  });

  it('creates a participant ticket that the scanner can parse', () => {
    const ticket = buildQrPayload({
      eventId: 'event-789',
      sessionId: 'session-3',
      participantCode: 'AERA-4821',
      ticketId: 'ticket-10',
    });

    expect(parseQrPayload(ticket)).toEqual({
      eventId: 'event-789',
      sessionId: 'session-3',
      participantCode: 'AERA-4821',
    });
  });

  it('hides an active session after its registration window ends', () => {
    expect(isRegistrationSessionAvailable({
      id: 'session-expired',
      event_id: 'event-1',
      session_name: 'Expired session',
      start_at: '2026-03-17T12:00:00.000Z',
      end_at: null,
      registration_open_at: null,
      registration_close_at: null,
      location_name: null,
      latitude: null,
      longitude: null,
      max_registrants: null,
      status: 'ACTIVE',
      sort_order: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    }, new Date('2026-08-20T00:00:00.000Z'))).toBe(false);
  });

  it('keeps a future active session available', () => {
    expect(isRegistrationSessionAvailable({
      id: 'session-future',
      event_id: 'event-2',
      session_name: 'Future session',
      start_at: '2026-09-17T12:00:00.000Z',
      end_at: '2026-09-17T16:00:00.000Z',
      registration_open_at: null,
      registration_close_at: '2026-09-17T11:00:00.000Z',
      location_name: null,
      latitude: null,
      longitude: null,
      max_registrants: null,
      status: 'ACTIVE',
      sort_order: 0,
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    }, new Date('2026-08-20T00:00:00.000Z'))).toBe(true);
  });
});
