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
