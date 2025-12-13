import type { OrgInventory } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
