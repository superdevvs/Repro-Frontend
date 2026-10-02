import { API_BASE_URL } from '@/config/env';

export type BufferMode = 'google' | 'mileage' | 'fixed';
export type BufferPolicy = {
  mode: BufferMode;
  fixed_minutes: number;
  minimum_minutes: number;
  allowance_minutes: number;
  fallback: 'mileage' | 'review';
  near_minutes: number;
  medium_minutes: number;
  far_minutes: number;
};
export type BufferSettingsResponse = {
  settings: BufferPolicy;
  version: string;
  google: {
    key_configured: boolean;
    budget: { used_elements: number; limit_elements: number; usage_percent: number; estimated_cost_usd: number; budget_usd: number; exhausted: boolean };
  };
};

export function bufferValidation(policy: BufferPolicy): string | null {
  const fields = [policy.fixed_minutes, policy.minimum_minutes, policy.near_minutes, policy.medium_minutes, policy.far_minutes];
  if (fields.some(value => !Number.isInteger(value) || value < 15 || value > 120 || value % 5 !== 0)) {
    return 'Gaps must be 15–120 minutes, in 5-minute steps.';
  }
  if (!Number.isInteger(policy.allowance_minutes) || policy.allowance_minutes < 0 || policy.allowance_minutes > 30 || policy.allowance_minutes % 5 !== 0) {
    return 'The arrival allowance must be 0–30 minutes, in 5-minute steps.';
  }
  if (policy.near_minutes > policy.medium_minutes || policy.medium_minutes > policy.far_minutes) {
    return 'Longer-distance gaps must be at least as long as the previous band.';
  }
  return null;
}

export async function requestBufferSettings(signal?: AbortSignal, body?: BufferPolicy & { version: string }): Promise<BufferSettingsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/admin/scheduling/buffer-settings`, {
    method: body ? 'PUT' : 'GET', signal,
    headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Could not load buffer settings. Please try again.');
  return payload.data;
}
