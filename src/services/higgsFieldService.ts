import { apiClient } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoPreset {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  max_frames: number;
  is_active: boolean;
  sort_order: number;
  prompt_template?: string; // Only returned for admin users
}

export interface VerticalVariant {
  id: number;
  variant_index: number;
  status: 'pending' | 'completed' | 'failed';
  image_url: string | null;
  is_selected: boolean;
}

export interface VideoGenerationJob {
  id: number;
  shoot_id: number;
  preset_id: number;
  preset_name: string;
  status:
    | 'pending'
    | 'converting_aspect'
    | 'awaiting_approval'
    | 'generating'
    | 'completed'
    | 'failed'
    | 'cancelled';
  aspect_ratio: 'horizontal' | 'vertical';
  start_frame_file_id: number;
  end_frame_file_id: number | null;
  original_start_frame_url: string;
  original_end_frame_url: string | null;
  start_frame_variants: VerticalVariant[];
  end_frame_variants: VerticalVariant[];
  selected_start_frame_url: string | null;
  selected_end_frame_url: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitVideoRequest {
  shoot_id: number;
  start_frame_file_id: number;
  end_frame_file_id?: number;
  preset_id: number;
  aspect_ratio: 'horizontal' | 'vertical';
}

export interface SelectVariantsRequest {
  start_frame_variant_id: number;
  end_frame_variant_id?: number;
}

export interface ListJobsParams {
  shoot_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const higgsFieldService = {
  // ── Presets ──────────────────────────────────────────────────────────

  async getPresets(): Promise<VideoPreset[]> {
    const response = await apiClient.get('/higgsfield/presets');
    return response.data.data || response.data || [];
  },

  async createPreset(data: Partial<VideoPreset>): Promise<VideoPreset> {
    const response = await apiClient.post('/higgsfield/presets', data);
    return response.data.data || response.data;
  },

  async updatePreset(id: number, data: Partial<VideoPreset>): Promise<VideoPreset> {
    const response = await apiClient.put(`/higgsfield/presets/${id}`, data);
    return response.data.data || response.data;
  },

  async deletePreset(id: number): Promise<void> {
    await apiClient.delete(`/higgsfield/presets/${id}`);
  },

  // ── Video Generation ────────────────────────────────────────────────

  async submitVideoGeneration(request: SubmitVideoRequest): Promise<VideoGenerationJob> {
    const response = await apiClient.post('/higgsfield/generate', request);
    return response.data.data || response.data;
  },

  async getJobStatus(jobId: number): Promise<VideoGenerationJob> {
    const response = await apiClient.get(`/higgsfield/jobs/${jobId}`);
    return response.data.data || response.data;
  },

  async listJobs(params?: ListJobsParams): Promise<PaginatedResponse<VideoGenerationJob>> {
    const response = await apiClient.get('/higgsfield/jobs', { params });
    return {
      data: response.data.data || response.data || [],
      meta: response.data.meta,
    };
  },

  // ── Variant Approval ────────────────────────────────────────────────

  async selectVariants(jobId: number, selections: SelectVariantsRequest): Promise<VideoGenerationJob> {
    const response = await apiClient.post(`/higgsfield/jobs/${jobId}/select-variants`, selections);
    return response.data.data || response.data;
  },

  async regenerateVariants(jobId: number): Promise<VideoGenerationJob> {
    const response = await apiClient.post(`/higgsfield/jobs/${jobId}/regenerate-variants`);
    return response.data.data || response.data;
  },

  // ── Job Management ──────────────────────────────────────────────────

  async cancelJob(jobId: number): Promise<void> {
    await apiClient.post(`/higgsfield/jobs/${jobId}/cancel`);
  },
};
