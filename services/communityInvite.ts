import QRCode from 'qrcode';

export type PendingCommunityInvite = {
  communityId: string;
  source: 'qr' | 'link';
  capturedAt: string;
};

export type CommunityQrSeed = {
  communityId: string;
  name: string;
  type: 'CHURCH' | 'NGO';
};

const PENDING_COMMUNITY_INVITE_KEY = 'aera_pending_community_invite_v1';
export const DEFAULT_COMMUNITY_INVITE_BASE_URL = 'https://appandwebsitetesting.site/';

export const DEMO_COMMUNITY_QR_SEEDS: CommunityQrSeed[] = [
  { communityId: 'NG-1001', name: 'Network Response Hub', type: 'NGO' },
  { communityId: 'CH-9921', name: 'Grace Community Church', type: 'CHURCH' },
  { communityId: 'NGO-5500', name: 'Regional Aid Network', type: 'NGO' },
  { communityId: 'TX-HOPE-HUB-03', name: 'Hope Hub Church', type: 'CHURCH' },
];

export function normalizeCommunityInviteCode(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[–—−]/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export function buildCommunityInviteUrl(
  communityId: string,
  baseUrl: string = DEFAULT_COMMUNITY_INVITE_BASE_URL,
): string {
  const normalized = normalizeCommunityInviteCode(communityId);
  if (!normalized) return baseUrl;

  const url = new URL(baseUrl);
  url.searchParams.set('communityId', normalized);
  url.searchParams.set('join', '1');
  return url.toString();
}

export function getPendingCommunityInvite(): PendingCommunityInvite | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_COMMUNITY_INVITE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCommunityInvite>;
    const communityId = normalizeCommunityInviteCode(parsed.communityId);
    if (!communityId) return null;
    return {
      communityId,
      source: parsed.source === 'link' ? 'link' : 'qr',
      capturedAt: String(parsed.capturedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function setPendingCommunityInvite(
  communityId: string,
  source: PendingCommunityInvite['source'] = 'qr',
): PendingCommunityInvite | null {
  if (typeof window === 'undefined') return null;
  const normalized = normalizeCommunityInviteCode(communityId);
  if (!normalized) return null;

  const payload: PendingCommunityInvite = {
    communityId: normalized,
    source,
    capturedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(PENDING_COMMUNITY_INVITE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearPendingCommunityInvite() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_COMMUNITY_INVITE_KEY);
}

export function capturePendingCommunityInviteFromUrl(): PendingCommunityInvite | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);

  const fromSearch =
    url.searchParams.get('communityId') ||
    url.searchParams.get('org') ||
    url.searchParams.get('code');
  const fromHash =
    hashParams.get('communityId') ||
    hashParams.get('org') ||
    hashParams.get('code');

  const normalized = normalizeCommunityInviteCode(fromSearch || fromHash || '');
  if (!normalized) return getPendingCommunityInvite();

  const pending = setPendingCommunityInvite(normalized, 'qr');

  url.searchParams.delete('communityId');
  url.searchParams.delete('org');
  url.searchParams.delete('code');
  url.searchParams.delete('join');

  hashParams.delete('communityId');
  hashParams.delete('org');
  hashParams.delete('code');
  hashParams.delete('join');

  const nextHash = hashParams.toString();
  const nextUrl = `${url.pathname}${url.search}${nextHash ? `#${nextHash}` : ''}`;
  window.history.replaceState({}, document.title, nextUrl);

  return pending;
}

export async function generateCommunityInviteQrDataUrl(
  communityId: string,
  baseUrl?: string,
): Promise<string> {
  const inviteUrl = buildCommunityInviteUrl(communityId, baseUrl);
  return QRCode.toDataURL(inviteUrl, {
    width: 240,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateCommunityInviteQrSvg(
  communityId: string,
  baseUrl?: string,
): Promise<string> {
  const inviteUrl = buildCommunityInviteUrl(communityId, baseUrl);
  return QRCode.toString(inviteUrl, {
    type: 'svg',
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}