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

export interface EditingJobOutputFile {
  id: number;
  filename?: string | null;
  url?: string | null;
  thumb_url?: string | null;
}

export interface EditingJob {
  id: number;
  shoot_id: number | null;
  shoot_file_id?: number | null;
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
  output_file?: EditingJobOutputFile | null;
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

  /**
   * Stage uploaded images for chat-driven Autoenhance flows. The files are
   * persisted on the server but NOT submitted to Autoenhance yet — Robbie
   * will commit them after collecting mode + params via chat.
   */
  async stageImages(files: File[]): Promise<{
    staged: Array<{
      id: string;
      name: string;
      content_type: string;
      size: number;
      preview_url?: string;
    }>;
    skipped: any[];
  }> {
    if (!files || files.length === 0) {
      return { staged: [], skipped: [] };
    }
    const form = new FormData();
    files.forEach((file) => form.append('images[]', file, file.name));

    const response = await apiClient.post('/autoenhance/quick-edit/stage', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return {
      staged: response.data?.staged ?? [],
      skipped: response.data?.skipped ?? [],
    };
  },

  /**
   * Submit ad-hoc image files (not tied to an existing shoot) directly to Autoenhance.
   * The backend uploads each image individually as its own job, so each file gets
   * its own EditingJob and progresses independently in the Activity list.
   */
  async quickEdit(
    files: File[],
    options?: { editingType?: string; params?: Record<string, any> }
  ): Promise<{ data: EditingJob[]; skipped: any[] }> {
    if (!files || files.length === 0) {
      return { data: [], skipped: [] };
    }
    const form = new FormData();
    files.forEach((file) => form.append('images[]', file, file.name));
    if (options?.editingType) {
      form.append('editing_type', options.editingType);
    }
    if (options?.params) {
      form.append('params', JSON.stringify(options.params));
    }

    const response = await apiClient.post('/autoenhance/quick-edit', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return {
      data: response.data?.data ?? [],
      skipped: response.data?.skipped ?? [],
    };
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

  /**
   * Synchronously ask the backend to poll Autoenhance for the status of every
   * job that is still `processing`. This is the local-dev driver that
   * progresses jobs to `completed` / `failed` since webhooks aren't reachable.
   */
  async pollProcessingJobs(): Promise<{ polled: number; updated: number[] }> {
    const response = await apiClient.post('/autoenhance/jobs/poll');
    return {
      polled: response.data?.polled ?? 0,
      updated: response.data?.updated ?? [],
    };
  },

  async getConnectionStatus(): Promise<ConnectionStatus> {
    const response = await apiClient.get('/autoenhance/connection-status');
    return response.data.data || response.data;
  },
};
