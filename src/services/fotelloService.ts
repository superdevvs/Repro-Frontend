import { apiClient } from './api';

export interface EditingType {
  id: string;
  name: string;
  description: string;
  params?: Record<string, any>;
}

export interface EditingJob {
  id: number;
  shoot_id: number;
  shoot_file_id?: number;
  fotello_job_id?: string;
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

export const fotelloService = {
  /**
   * Get available editing types
   */
  async getEditingTypes(): Promise<EditingType[]> {
    const response = await apiClient.get('/fotello/editing-types');
    return response.data.data || response.data || [];
  },

  /**
   * Submit image(s) for AI editing
   */
  async submitEditing(request: SubmitEditingRequest): Promise<EditingJob[]> {
    const response = await apiClient.post('/fotello/edit', request);
    return response.data.data || response.data || [];
  },

  /**
   * Get job status
   */
  async getJobStatus(jobId: number): Promise<EditingJob> {
    const response = await apiClient.get(`/fotello/jobs/${jobId}`);
    return response.data.data || response.data;
  },

  /**
   * List all jobs
   */
  async listJobs(params?: ListJobsParams): Promise<{
    data: EditingJob[];
    meta?: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  }> {
    const response = await apiClient.get('/fotello/jobs', { params });
    return {
      data: response.data.data || response.data || [],
      meta: response.data.meta,
    };
  },

  /**
   * Cancel a job
   */
  async cancelJob(jobId: number): Promise<void> {
    await apiClient.post(`/fotello/jobs/${jobId}/cancel`);
  },
};

