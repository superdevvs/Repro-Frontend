import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useAuth } from '@/components/auth';
import { withApiBase } from '@/config/env';

type SaveProfilePayload = Record<string, unknown>;

interface SaveProfileResponse {
  message?: string;
  reauth_required?: boolean;
  user?: Record<string, unknown>;
}

const extractErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
    const firstError = data.errors
      ? Object.values(data.errors).flat().find(Boolean)
      : null;

    return firstError || data.message || 'Failed to update profile';
  } catch {
    return 'Failed to update profile';
  }
};

export function useSelfProfileSave() {
  const navigate = useNavigate();
  const { setUser, logout } = useAuth();

  const saveProfile = useCallback(
    async (payload: SaveProfilePayload) => {
      const token =
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('access_token');

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(withApiBase('/api/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const data = (await response.json()) as SaveProfileResponse;

      if (data.user) {
        setUser(data.user as any);
      }

      if (data.reauth_required) {
        toast.success(data.message || 'Your account was updated. Please sign in again.');
        logout();
        navigate('/', { replace: true });
      }

      return {
        message: data.message || 'Profile updated successfully',
        reauthRequired: Boolean(data.reauth_required),
        user: data.user,
      };
    },
    [logout, navigate, setUser],
  );

  return { saveProfile };
}
