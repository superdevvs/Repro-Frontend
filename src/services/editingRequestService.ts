import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from '@/services/api';

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

export type EditingRequestUpdatePayload = {
  status?: 'open' | 'in_progress' | 'completed';
  priority?: 'low' | 'normal' | 'high';
  details?: string;
};

const getHeaders = () => {
  const headers = getApiHeaders();
  if (!headers.Authorization) {
    throw new Error('Missing auth token');
  }
  return headers;
};

export async function submitEditingRequest(payload: EditingRequestPayload): Promise<EditingRequest> {
  const headers = getHeaders();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(`${API_BASE_URL}/api/editing-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        shoot_id: payload.shootId,
        summary: payload.summary,
        details: payload.details,
        priority: payload.priority,
        target_team: payload.targetTeam,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.message || 'Unable to submit editing request');
    }

    const json = await response.json();
    return json.data || json;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

export async function fetchEditingRequests(): Promise<EditingRequest[]> {
  const headers = getHeaders();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/editing-requests`, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.message || 'Unable to load requests');
    }

    const json = await response.json();
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    return [];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

export async function updateEditingRequest(
  id: number,
  payload: EditingRequestUpdatePayload
): Promise<EditingRequest> {
  const headers = getHeaders();

  const response = await fetch(`${API_BASE_URL}/api/editing-requests/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Unable to update request');
  }

  const json = await response.json();
  return json.data || json;
}

export async function deleteEditingRequest(id: number): Promise<void> {
  const headers = getHeaders();

  const response = await fetch(`${API_BASE_URL}/api/editing-requests/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || 'Unable to delete request');
  }
}
