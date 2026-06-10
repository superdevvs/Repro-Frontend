import { apiClient } from './api';

export type ReelStatus = 'queued' | 'processing' | 'stitching' | 'completed' | 'failed' | 'cancelled';

export interface ReelOutput {
  label: string;
  url: string;
}

export interface ReelSelectedFile {
  id: number;
  filename: string;
  thumb_url: string | null;
}

export interface ReelJob {
  id: number;
  shoot_id: number;
  user_id: number;
  provider: 'fal' | string;
  selected_file_ids: number[];
  selected_files: ReelSelectedFile[];
  status: ReelStatus;
  outputs: Record<string, ReelOutput> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  shoot: {
    id: number;
    address: string;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
}

export interface SubmitReelRequest {
  shoot_id: number;
  selected_file_ids: number[];
}

export interface ReelJobsParams {
  shoot_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}

export interface PaginatedReelJobs {
  data: ReelJob[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export const reelService = {
  async submitReel(request: SubmitReelRequest): Promise<ReelJob> {
    const response = await apiClient.post('/reels/generate', request);
    return response.data.data || response.data;
  },

  async listJobs(params?: ReelJobsParams): Promise<PaginatedReelJobs> {
    const response = await apiClient.get('/reels/jobs', { params });
    return {
      data: response.data.data || response.data || [],
      meta: response.data.meta,
    };
  },

  async getJob(jobId: number): Promise<ReelJob> {
    const response = await apiClient.get(`/reels/jobs/${jobId}`);
    return response.data.data || response.data;
  },

  async cancelJob(jobId: number): Promise<ReelJob> {
    const response = await apiClient.post(`/reels/jobs/${jobId}/cancel`);
    return response.data.data || response.data;
  },
};
