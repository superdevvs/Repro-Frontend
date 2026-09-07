import { apiClient } from './api';
import { studioService, type SourceMedia, type StudioShootRef, type WorkflowId, type UploadProgressHandler } from './studioService';
import type { V4Config, V4Feedback, V4Media, V4Segment, V4Workspace } from '@/components/studio/v4/types';

const base = '/studio/workspaces';
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;
export const sourceMedia = (m: SourceMedia): V4Media => ({ id: `file:${m.id}`, fileId: m.id, shootId: m.shootId, name: m.filename, kind: m.mediaType === 'video' ? 'video' : m.mediaType === 'raw' ? 'raw' : 'image', url: m.previewUrl || m.thumbnailUrl || '', thumbnailUrl: m.thumbnailUrl || m.previewUrl || '' });
export const studioWorkspaceService = {
  async list(): Promise<V4Workspace[]> { return (await apiClient.get(base)).data.data; },
  async get(id: string): Promise<V4Workspace> { return (await apiClient.get(path(id))).data.data; },
  async create(input: { name: string; presetId: string; media: V4Media[]; config: V4Config }, requestId: string): Promise<V4Workspace> {
    return (await apiClient.post(base, { ...input, requestId })).data.data;
  },
  async update(id: string, input: { config?: V4Config; media?: V4Media[]; name?: string; version?: number }): Promise<V4Workspace> {
    return (await apiClient.patch(path(id), input)).data.data;
  },
  async run(id: string, action: 'prepare' | 'generate' | 'cancel'): Promise<V4Workspace> {
    return (await apiClient.post(`${path(id)}/${action}`)).data.data;
  },
  async revise(id: string, input: V4Feedback): Promise<V4Workspace> {
    return (await apiClient.post(`${path(id)}/revisions`, input)).data.data;
  },
  async upscale(id: string, mediaId: string, outputId: string): Promise<V4Workspace> {
    return (await apiClient.post(`${path(id)}/upscale`, { mediaId, outputId })).data.data;
  },
  async detect(id: string, mediaId: string): Promise<V4Segment[]> {
    return (await apiClient.post(`${path(id)}/segments`, { mediaId })).data.data;
  },
};

/** Source endpoints apply client delivery visibility as well as shoot access. */
export const workspaceSources = {
  async resolveShoot(shootId: string): Promise<{ ok: boolean; record?: Record<string, unknown>; errorMessage?: string }> {
    const response = await apiClient.post(`${base}/sources/resolve`, { destination: 'command-center', recordType: 'shoot', recordId: shootId });
    return { ok: true, record: response.data.data?.record };
  },
  async searchShoots(query: string): Promise<StudioShootRef[]> {
    return (await apiClient.get(`${base}/sources/shoots`, { params: { q: query } })).data.data;
  },
  async getShootMedia(shootId: number, workflow: WorkflowId): Promise<SourceMedia[]> {
    return (await apiClient.get(`${base}/sources/shoots/${shootId}/media`, { params: { workflow } })).data.data;
  },
  upload: (files: File[], workflow: WorkflowId, onProgress?: UploadProgressHandler) => studioService.upload(files, workflow, onProgress, `${base}/sources/uploads`),
};

export function studioError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string; error?: { message?: string }; errors?: Record<string, string[]> } } })?.response?.data;
  return response?.message || response?.error?.message || (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}
