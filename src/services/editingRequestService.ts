import { API_BASE_URL } from '@/config/env';

export type EditingRequest = {
  id: number;
  shoot_id?: number | null;
  tracking_code: string;
  summary: string;
  details?: string | null;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'in_progress' | 'completed';
  target_team: string;
  created_at?: string;
  shoot?: {
    id: number;
    address?: string | null;
    scheduled_date?: string | null;
  } | null;
  requester?: {
    id: number;
    name: string;
    email?: string | null;
  } | null;
};

export type EditingRequestPayload = {
  shootId?: number;
  summary: string;
  details?: string;
  priority: 'low' | 'normal' | 'high';
  targetTeam: 'editor' | 'admin' | 'hybrid';
};

const getToken = () => localStorage.getItem('authToken') || localStorage.getItem('token');

export async function submitEditingRequest(payload: EditingRequestPayload) {
  const token = getToken();
  if (!token) {
    throw new Error('Missing auth token');
  }

  const response = await fetch(`${API_BASE_URL}/api/editing-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shoot_id: payload.shootId,
      summary: payload.summary,
      details: payload.details,
      priority: payload.priority,
      target_team: payload.targetTeam,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Unable to submit editing request');
  }

  return response.json();
}

export async function fetchEditingRequests(): Promise<EditingRequest[]> {
  const token = getToken();
  if (!token) {
    throw new Error('Missing auth token');
  }

  const response = await fetch(`${API_BASE_URL}/api/editing-requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Unable to load requests');
  }

  const json = await response.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

