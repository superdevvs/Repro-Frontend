import axios from 'axios';

import { apiClient } from '@/services/api';

export interface ProfileActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  timestamp: string | null;
  ip_address: string | null;
  device: string;
}

export interface ProfileSession {
  id: string;
  name: string;
  device: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  last_active_at: string | null;
  current: boolean;
}

export interface ProfileSecurityStatus {
  two_factor: {
    enabled: boolean;
    confirmed_at: string | null;
    recovery_codes_remaining: number;
  };
  password: {
    changed_at: string | null;
  };
  sessions: ProfileSession[];
}

export interface TwoFactorSetup {
  secret: string;
  otpauth_uri: string;
  expires_in_seconds: number;
}

type ErrorPayload = {
  message?: string;
  errors?: Record<string, string[]>;
};

export const profileSecurityErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ErrorPayload>(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const firstValidationError = error.response?.data?.errors
    ? Object.values(error.response.data.errors).flat().find(Boolean)
    : undefined;

  return firstValidationError || error.response?.data?.message || fallback;
};

export const getProfileActivity = async (limit = 50): Promise<ProfileActivity[]> => {
  const response = await apiClient.get<{ activities: ProfileActivity[] }>('/profile/activity', {
    params: { limit },
  });
  return response.data.activities;
};

export const getProfileSecurity = async (): Promise<ProfileSecurityStatus> => {
  const response = await apiClient.get<ProfileSecurityStatus>('/profile/security');
  return response.data;
};

export const beginTwoFactorSetup = async (currentPassword: string): Promise<TwoFactorSetup> => {
  const response = await apiClient.post<TwoFactorSetup>('/profile/security/two-factor/setup', {
    current_password: currentPassword,
  });
  return response.data;
};

export const confirmTwoFactorSetup = async (currentPassword: string, code: string): Promise<string[]> => {
  const response = await apiClient.post<{ recovery_codes: string[] }>('/profile/security/two-factor/confirm', {
    current_password: currentPassword,
    code,
  });
  return response.data.recovery_codes;
};

export const disableTwoFactor = async (currentPassword: string, code: string): Promise<void> => {
  await apiClient.delete('/profile/security/two-factor', {
    data: { current_password: currentPassword, code },
  });
};

export const regenerateTwoFactorRecoveryCodes = async (currentPassword: string, code: string): Promise<string[]> => {
  const response = await apiClient.post<{ recovery_codes: string[] }>('/profile/security/two-factor/recovery-codes', {
    current_password: currentPassword,
    code,
  });
  return response.data.recovery_codes;
};

export const revokeProfileSession = async (sessionId: string, currentPassword: string): Promise<void> => {
  await apiClient.delete(`/profile/security/sessions/${encodeURIComponent(sessionId)}`, {
    data: { current_password: currentPassword },
  });
};

export const revokeOtherProfileSessions = async (currentPassword: string): Promise<number> => {
  const response = await apiClient.delete<{ revoked_count: number }>('/profile/security/sessions/others', {
    data: { current_password: currentPassword },
  });
  return response.data.revoked_count;
};

export const notifyProfileActivityChanged = () => {
  window.dispatchEvent(new CustomEvent('profile-activity-changed'));
};
