import { apiClient } from './api';
import type { EmailTemplateArtwork, EmailWorkspaceDraft, EmailTemplateProposal, EmailArtworkKind } from '@/types/emailTemplateWorkspace';

export async function suggestEmailTemplate(data: {
  videos?: { url: string; asset_id?: string }[]; asset_ids?: string[]; video_urls?: string[]; template_id?: number; instruction: string; scope: 'email' | 'subject' | 'section'; section_id?: string; draft: EmailWorkspaceDraft;
}): Promise<EmailTemplateProposal> {
  const response = await apiClient.post('/messaging/templates/assist', data, { timeout: 200000 });
  return { ...response.data.draft, assistant_context: response.data.context };
}

export async function generateEmailArtwork(data: { id: string; kind: EmailArtworkKind; prompt: string }): Promise<EmailTemplateArtwork> {
  const response = await apiClient.post('/messaging/templates/artwork', data);
  return response.data;
}

export async function getEmailArtwork(id: string): Promise<EmailTemplateArtwork> {
  const response = await apiClient.get(`/messaging/templates/artwork/${id}`);
  return response.data;
}
