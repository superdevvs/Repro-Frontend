import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/sonner-toast';

import { useAuth } from '@/components/auth';
import { withApiBase } from '@/config/env';

type SaveProfilePayload = Record<string, unknown>;

interface SaveProfileErrorPayload {
  message?: string;
  errors?: Record<string, string[]>;
  email_health?: Record<string, unknown>;
}

interface SaveProfileResponse {
  message?: string;
  reauth_required?: boolean;
  user?: Record<string, unknown>;
}

const extractErrorPayload = async (response: Response): Promise<{ message: string; payload?: SaveProfileErrorPayload }> => {
  try {
    const data = (await response.json()) as SaveProfileErrorPayload;
    const firstError = data.errors
      ? Object.values(data.errors).flat().find(Boolean)
      : null;

    return {
      message: firstError || data.message || 'Failed to update profile',
      payload: data,
    };
  } catch {
    return { message: 'Failed to update profile' };
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
        const { message, payload } = await extractErrorPayload(response);
        throw Object.assign(new Error(message), { payload });
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
