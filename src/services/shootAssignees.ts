import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

export interface ShootAssignee {
  id: string;
  name: string;
  email: string;
  role: string;
  secondary_roles?: string[];
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipcode?: string;
  metadata?: Record<string, string>;
}

export async function loadShootAssignees(signal?: AbortSignal): Promise<ShootAssignee[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/users?light=1`, {
    headers: getApiHeaders(), signal,
  });
  if (!response.ok) throw new Error('Unable to load assignment options. Please try again.');
  const payload = await response.json();
  if (!Array.isArray(payload.users)) throw new Error('Unable to load assignment options. Please try again.');
  return payload.users.map((user: ShootAssignee) => ({ ...user, id: String(user.id) }));
}

export function assigneesForRole(users: ShootAssignee[], role: 'editor' | 'photographer'): ShootAssignee[] {
  return users.filter(user => user.role === role || user.secondary_roles?.includes(role));
}
