import { API_BASE_URL } from '@/config/env';
import type {
  AdminPermissionsResponse,
  CurrentUserPermissionsResponse,
  RolePermissionIdsMap,
} from '@/types/permissions';

const getToken = () =>
  localStorage.getItem('authToken') ||
  localStorage.getItem('token') ||
  localStorage.getItem('access_token');

const createHeaders = () => {
  const token = getToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    let message = 'Request failed';

    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      // Ignore JSON parsing failures and use generic message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

export async function fetchCurrentUserPermissions(signal?: AbortSignal): Promise<CurrentUserPermissionsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/me/permissions`, {
    headers: createHeaders(),
    signal,
  });

  return parseJson<CurrentUserPermissionsResponse>(response);
}

export async function fetchAdminPermissionsConfig(signal?: AbortSignal): Promise<AdminPermissionsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/permissions`, {
    headers: createHeaders(),
    signal,
  });

  return parseJson<AdminPermissionsResponse>(response);
}

export async function updateAdminPermissionsConfig(permissions: RolePermissionIdsMap): Promise<RolePermissionIdsMap> {
  const response = await fetch(`${API_BASE_URL}/api/admin/permissions`, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify({ permissions }),
  });

  const data = await parseJson<{ permissions: RolePermissionIdsMap }>(response);
  return data.permissions;
}
