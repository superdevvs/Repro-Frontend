import { apiClient } from './api';
import type { EmailAssetOptions, EmailDashboardMedia, EmailMediaAsset, EmailServerDraft, EmailTemplateSection, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';

const base = '/messaging/templates';
export const emailWorkspaceCapabilities = async (): Promise<{ enabled: boolean; version: number }> => (await apiClient.get(base+'/capabilities')).data;
export const listEmailAssets = async (params: { source?: string; search?: string; page?: number }) => (await apiClient.get<{ data: EmailMediaAsset[]; last_page: number }>(base+'/assets', { params })).data;
export const getEmailAsset = async (id: string, templateId?: number): Promise<EmailMediaAsset> => (await apiClient.get(base+'/assets/'+id, { params: { template_id: templateId } })).data;
export async function uploadEmailAsset(file: File, options: EmailAssetOptions, onProgress?: (percent: number) => void): Promise<EmailMediaAsset> {
  const form = new FormData(); form.append('file', file);
  Object.entries(options).forEach(([key, value]) => { if (value !== undefined && value !== '') form.append(key, typeof value === 'boolean' ? value ? '1' : '0' : String(value)); });
  return (await apiClient.post(base+'/assets', form, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: event => onProgress?.(Math.round(100 * event.loaded / (event.total || file.size))), timeout: 90000 })).data;
}
export const archiveEmailAsset = async (id: string) => apiClient.delete(base+'/assets/'+id);
export const variantEmailAsset = async (id: string, options: EmailAssetOptions, templateId?: number): Promise<EmailMediaAsset> => (await apiClient.post(base+'/assets/'+id+'/variants', { ...options, template_id: templateId })).data;
export const listDashboardEmailMedia = async (search: string): Promise<EmailDashboardMedia[]> => (await apiClient.get(base+'/dashboard-media', { params: { search } })).data;
export const importDashboardEmailMedia = async (item: EmailDashboardMedia, options: EmailAssetOptions): Promise<EmailMediaAsset> => (await apiClient.post(base+'/dashboard-media', { shoot_id: item.shoot_id, unit_id: item.unit_id, url: item.url, ...options })).data;
export const resolveEmailVideo = async (url: string): Promise<{ url: string; title: string; provider: string; asset: EmailMediaAsset | null; needs_thumbnail: boolean }> => (await apiClient.post(base+'/video', { url })).data;
export const loadEmailServerDraft = async (templateId?: number): Promise<EmailServerDraft | null> => (await apiClient.get(base+'/drafts', { params: { template_id: templateId } })).data;
export const saveEmailServerDraft = async (id: string, revision: number, draft: EmailWorkspaceDraft, templateId?: number): Promise<{ id: string; revision: number }> => (await apiClient.put(base+'/drafts/'+id, { base_revision: revision, template_id: templateId, draft })).data;
export const deleteEmailServerDraft = async (id: string, revision: number) => apiClient.delete(base+'/drafts/'+id, { data: { base_revision: revision } });
export const getEmailRevisions = async (id: number): Promise<{ id: number; created_at: string; draft: EmailWorkspaceDraft }[]> => (await apiClient.get(base+'/'+id+'/revisions')).data;
export const listEmailSavedSections = async (): Promise<{ id: string; name: string; section: EmailTemplateSection }[]> => (await apiClient.get(base+'/sections')).data;
export const saveEmailSection = async (name: string, section: EmailTemplateSection) => apiClient.post(base+'/sections', { name, section });
