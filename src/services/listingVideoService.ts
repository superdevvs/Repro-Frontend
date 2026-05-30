import { apiClient } from './api';

export type ListingVideoStatus = 'queued' | 'processing' | 'stitching' | 'completed' | 'failed' | 'cancelled';

export interface ListingVideoOutput {
  label: string;
  url: string;
}

export interface ListingVideoSelectedFile {
  id: number;
  filename: string;
  thumb_url: string | null;
}

export interface ListingVideoJob {
  id: number;
  shoot_id: number;
  user_id: number;
  provider: 'fal' | string;
  selected_file_ids: number[];
  selected_files: ListingVideoSelectedFile[];
  target_seconds: number;
  status: ListingVideoStatus;
  total_clips: number;
  completed_clips: number;
  outputs: Record<string, ListingVideoOutput> | null;
  provider_request_ids: string[] | null;
  estimated_cost: number;
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

export interface SubmitListingVideoRequest {
  shoot_id: number;
  selected_file_ids: number[];
  target_seconds: 30 | 40 | 45;
}

export interface ListingVideoJobsParams {
  shoot_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}

export interface PaginatedListingVideoJobs {
  data: ListingVideoJob[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export const listingVideoService = {
  async submitListingVideo(request: SubmitListingVideoRequest): Promise<ListingVideoJob> {
    const response = await apiClient.post('/listing-videos/generate', request);
    return response.data.data || response.data;
  },

  async listJobs(params?: ListingVideoJobsParams): Promise<PaginatedListingVideoJobs> {
    const response = await apiClient.get('/listing-videos/jobs', { params });
    return {
      data: response.data.data || response.data || [],
      meta: response.data.meta,
    };
  },

  async getJob(jobId: number): Promise<ListingVideoJob> {
    const response = await apiClient.get(`/listing-videos/jobs/${jobId}`);
    return response.data.data || response.data;
  },

  async cancelJob(jobId: number): Promise<ListingVideoJob> {
    const response = await apiClient.post(`/listing-videos/jobs/${jobId}/cancel`);
    return response.data.data || response.data;
  },
};
