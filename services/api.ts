import type { OrgInventory } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Log API base URL for debugging
if (typeof window !== 'undefined') {
  console.log('🔗 API Base URL:', API_BASE);
}

export async function getInventory(orgId: string): Promise<OrgInventory> {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/inventory`);
  if (!res.ok) throw new Error('Failed to load inventory');
  return res.json();
}

export async function saveInventory(orgId: string, inventory: OrgInventory): Promise<void> {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inventory),
  });
  if (!res.ok) throw new Error('Failed to save inventory');
}

export async function listRequests(orgId: string) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/requests`);
  if (!res.ok) throw new Error('Failed to load requests');
  return res.json();
}

export async function createRequest(orgId: string, payload: { item: string; quantity: number; provider?: string; orgName?: string }) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create request');
  return res.json();
}

export async function updateRequestStatus(id: string, payload: { status: string; deliveredQuantity?: number }) {
  const res = await fetch(`${API_BASE}/api/requests/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update request');
  return res.json();
}

export async function getMemberStatus(orgId: string) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/status`);
  if (!res.ok) throw new Error('Failed to load member status');
  return res.json(); // { counts, members }
}

export async function setMemberStatus(orgId: string, payload: { memberId: string; name?: string; status: 'SAFE' | 'DANGER' | 'UNKNOWN' }) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save member status');
  return res.json();
}

export async function getBroadcast(orgId: string) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/broadcast`);
  if (!res.ok) throw new Error('Failed to load broadcast');
  return res.json();
}

export async function setBroadcast(orgId: string, message: string) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Failed to save broadcast');
  return res.json();
}

// Auth
export async function registerAuth(payload: { email?: string; phone?: string; password: string; fullName?: string; role?: string; orgId?: string }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to register');
  return res.json(); // { token, user }
}

export async function loginAuth(payload: { email?: string; phone?: string; password: string }) {
  try {
    const url = `${API_BASE}/api/auth/login`;
    console.log('📡 Attempting login to:', url);
    console.log('📝 Payload:', payload);
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    console.log('📊 Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      try {
        const errorData = await res.json();
        console.error('❌ Server error:', errorData);
        throw new Error(errorData.error || `Failed to login: ${res.statusText}`);
      } catch (parseErr) {
        console.error('❌ Could not parse error response:', parseErr);
        throw new Error(`Login failed with status ${res.status}`);
      }
    }
    
    const data = await res.json();
    console.log('✅ Login successful, got token:', data.token ? 'YES' : 'NO');
    return data;
  } catch (err: any) {
    console.error('❌ Login API error:', err.message || err);
    throw err;
  }
}

export async function forgotPassword(payload: { email: string }) {
  const res = await fetch(`${API_BASE}/api/auth/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to request reset');
  return res.json(); // { ok, resetToken? }
}

export async function resetPassword(payload: { email: string; token: string; newPassword: string }) {
  const res = await fetch(`${API_BASE}/api/auth/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to reset password');
  return res.json(); // { ok }
}

// Help Requests
export async function createHelpRequest(userId: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/users/${userId}/help`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create help request');
  return res.json();
}

export async function getActiveHelpRequest(userId: string) {
  const res = await fetch(`${API_BASE}/api/users/${userId}/help/active`);
  if (!res.ok) throw new Error('Failed to load help request');
  return res.json();
}

export async function updateHelpRequestLocation(id: string, location: string) {
  const res = await fetch(`${API_BASE}/api/help/${id}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location }),
  });
  if (!res.ok) throw new Error('Failed to update help request location');
  return res.json();
}

// Member CRUD
export async function listMembers(orgId: string) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/members`);
  if (!res.ok) throw new Error('Failed to load members');
  return res.json();
}

export async function addMember(orgId: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to add member');
  return res.json();
}

export async function updateMember(orgId: string, memberId: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/members/${memberId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update member');
  return res.json();
}

export async function removeMember(orgId: string, memberId: string) {
  const res = await fetch(`${API_BASE}/api/orgs/${orgId}/members/${memberId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to remove member');
  return res.json();
}
