import { API_BASE_URL } from '@/config/env';
import { getApiHeaders } from './api';
import { getStoredAuthToken } from '@/utils/authToken';

export type InsightPriority = 'blocking' | 'attention' | 'insight' | 'assistive';
export interface RobbieInsight {
  id: string;
  priority: InsightPriority;
  message: string;
  prompt: string;
  intent?: string;
  action?: string;
  insightType?: string;
  entity?: string;
  filters?: Record<string, unknown>;
}

type InsightResult = { insights: RobbieInsight[]; error: string | null };
type RequestState = {
  token: string;
  impersonatedUser: string;
  retryAt: number;
  pending?: Promise<InsightResult>;
  result?: InsightResult;
};

// Shared across strip mounts: route changes must not restart failed polling.
let state: RequestState | undefined;
export const INSIGHTS_REFRESH_MS = 60_000;

export function fetchRobbieInsights(): Promise<InsightResult> {
  const token = getStoredAuthToken();
  if (!token) {
    state = undefined;
    return Promise.resolve({ insights: [], error: null });
  }
  const headers = getApiHeaders();
  const impersonatedUser = headers['X-Impersonate-User-Id'] ?? '';
  if (!state || state.token !== token || state.impersonatedUser !== impersonatedUser) {
    state = { token, impersonatedUser, retryAt: 0 };
  }
  const current = state;
  if (current.pending) return current.pending;
  if (current.result && Date.now() < current.retryAt) return Promise.resolve(current.result);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  current.pending = (async (): Promise<InsightResult> => {
    try {
      // Storage is authoritative; a mounted AuthProvider may have an older token.
      const response = await fetch(`${API_BASE_URL}/api/robbie/insights`, {
        headers: { ...headers, Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 419) {
        // Resume only after credentials change, including across strip remounts.
        current.retryAt = Infinity;
        return { insights: [], error: 'Sign in again to refresh Robbie insights.' };
      }
      if (!response.ok) {
        return { insights: [], error: 'Unable to load insights right now.' };
      }
      const data = await response.json();
      return { insights: data?.success && Array.isArray(data.insights) ? data.insights : [], error: null };
    } catch {
      return { insights: [], error: 'Unable to load insights right now.' };
    } finally {
      window.clearTimeout(timeout);
      if (current.retryAt !== Infinity) current.retryAt = Date.now() + INSIGHTS_REFRESH_MS;
    }
  })().then((result) => {
    current.result = result;
    current.pending = undefined;
    return result;
  });
  return current.pending;
}
