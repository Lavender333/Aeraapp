import { describe, expect, it } from 'vitest';
import {
  buildCommunityInviteUrl,
  DEFAULT_COMMUNITY_INVITE_BASE_URL,
  normalizeCommunityInviteCode,
  resolveCommunityInvite,
} from '../services/communityInvite';

describe('member join invite links', () => {
  it('uses the live AERA custom domain', () => {
    expect(DEFAULT_COMMUNITY_INVITE_BASE_URL).toBe('https://getaeraapp.com/');
    expect(buildCommunityInviteUrl('CH-9921')).toBe(
      'https://getaeraapp.com/?communityId=CH-9921&join=1',
    );
  });

  it('normalizes codes before embedding them in a join link', () => {
    expect(normalizeCommunityInviteCode(' ch—9921 ')).toBe('CH-9921');
    expect(buildCommunityInviteUrl(' ch—9921 ')).toContain('communityId=CH-9921');
  });

  it('preserves an explicit deployment path and existing parameters', () => {
    expect(buildCommunityInviteUrl('ng-1001', 'https://example.org/aera/?source=poster')).toBe(
      'https://example.org/aera/?source=poster&communityId=NG-1001&join=1',
    );
  });

  it('requires confirmation before changing a signed-in member community', () => {
    const pending = {
      communityId: 'CH-9921',
      source: 'qr' as const,
      capturedAt: '2026-07-24T00:00:00.000Z',
    };

    expect(resolveCommunityInvite('', pending)).toBe('needs-confirmation');
    expect(resolveCommunityInvite('NG-1001', pending)).toBe('needs-confirmation');
    expect(resolveCommunityInvite('ch—9921', pending)).toBe('already-connected');
    expect(resolveCommunityInvite('CH-9921', null)).toBe('none');
  });
});
