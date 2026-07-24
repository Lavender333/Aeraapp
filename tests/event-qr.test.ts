import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildEventRegistrationLink,
  buildQrPayload,
  DEFAULT_EVENT_REGISTRATION_BASE_URL,
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
});
