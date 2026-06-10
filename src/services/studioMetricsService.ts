import { apiClient } from './api';

/**
 * Studio metrics service.
 *
 * Mirrors `listingVideoService` conventions: it talks to the backend through the
 * shared `apiClient` instance, so the dashboard Bearer token (read from
 * `localStorage`) is attached automatically by the request interceptor
 * (Req 9.6 / 12.2). Endpoints are aggregated read-only views that combine
 * `AiEditingJob` (photo) and `AiListingVideoJob` (video) records.
 *
 * `apiClient` is configured with a baseURL ending in `/api`, so paths here are
 * written relative to that namespace (e.g. `/studio/metrics/hero` →
 * `GET /api/studio/metrics/hero`).
 */

export type StudioJobType = 'photo' | 'video';

export interface StudioHeroStats {
  projects_count: number;
  ai_jobs_completed: number;
  success_rate: number; // percentage 0–100
}

export interface StudioRecentProject {
  shoot_id: number;
  address: string;
  last_activity_at: string; // ISO
  latest_status: string;
  latest_job_type: StudioJobType;
}

export interface StudioActiveJob {
  id: number;
  job_type: StudioJobType;
  shoot_id: number;
  shoot_address: string | null;
  status: string;
}

export interface StudioRecentProjectsParams {
  limit?: number;
}

export const studioMetricsService = {
  async getHeroStats(): Promise<StudioHeroStats> {
    const response = await apiClient.get('/studio/metrics/hero');
    return response.data.data || response.data;
  },

  async getRecentProjects(params?: StudioRecentProjectsParams): Promise<StudioRecentProject[]> {
    const response = await apiClient.get('/studio/metrics/recent-projects', { params });
    return response.data.data || response.data || [];
  },

  async getActiveQueue(): Promise<StudioActiveJob[]> {
    const response = await apiClient.get('/studio/metrics/active-queue');
    return response.data.data || response.data || [];
  },
};
