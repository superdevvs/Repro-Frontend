import { apiClient } from './api';

export interface EditingType {
  id: string;
  name: string;
  description: string;
  params?: Record<string, any>;
}

export interface EditingJobShoot {
  id: number;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface EditingJobSourceFile {
  id: number;
  filename?: string | null;
  thumb_url?: string | null;
}

export interface EditingJob {
  id: number;
  shoot_id: number;
  shoot_file_id?: number;
  provider?: string;
  provider_job_id?: string;
  provider_order_id?: string;
  autoenhance_image_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  editing_type: string;
  editing_params?: Record<string, any>;
  original_image_url: string;
  edited_image_url?: string;
  error_message?: string;
  retry_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  shoot?: EditingJobShoot | null;
  source_file?: EditingJobSourceFile | null;
}

export interface ConnectionStatus {
  success: boolean;
  status: number;
  message?: string;
  editing_types_count?: number;
}

export interface SubmitEditingRequest {
  shoot_id: number;
  file_ids: number[];
  editing_type: string;
  params?: Record<string, any>;
}

export interface ListJobsParams {
  shoot_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}

export const autoenhanceService = {
  async getEditingTypes(): Promise<EditingType[]> {
    const response = await apiClient.get('/autoenhance/editing-types');
    return response.data.data || response.data || [];
  },

  async submitEditing(request: SubmitEditingRequest): Promise<EditingJob[]> {
    const response = await apiClient.post('/autoenhance/edit', request);
    return response.data.data || response.data || [];
  },

  async getJobStatus(jobId: number): Promise<EditingJob> {
    const response = await apiClient.get(`/autoenhance/jobs/${jobId}`);
    return response.data.data || response.data;
  },

  async listJobs(params?: ListJobsParams): Promise<{
    data: EditingJob[];
    meta?: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  }> {
    const response = await apiClient.get('/autoenhance/jobs', { params });
    return {
      data: response.data.data || response.data || [],
      meta: response.data.meta,
    };
  },

  async cancelJob(jobId: number): Promise<void> {
    await apiClient.post(`/autoenhance/jobs/${jobId}/cancel`);
  },

  async retryJob(jobId: number): Promise<EditingJob> {
    const response = await apiClient.post(`/autoenhance/jobs/${jobId}/retry`);
    return response.data.data || response.data;
  },

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const response = await apiClient.get('/autoenhance/connection-status');
    return response.data.data || response.data;
  },
};
