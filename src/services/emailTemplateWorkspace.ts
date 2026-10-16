import { apiClient } from './api';
import type { EmailTemplateArtwork, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';

export async function suggestEmailTemplate(data: {
  template_id?: number; instruction: string; scope: 'email' | 'subject' | 'section'; section_id?: string; draft: EmailWorkspaceDraft;
}): Promise<Partial<EmailWorkspaceDraft>> {
  const response = await apiClient.post('/messaging/templates/assist', data, { timeout: 120000 });
  return response.data.draft;
}

export async function generateEmailArtwork(data: { id: string; kind: 'illustration' | 'icon'; prompt: string }): Promise<EmailTemplateArtwork> {
  const response = await apiClient.post('/messaging/templates/artwork', data);
  return response.data;
}

export async function getEmailArtwork(id: string): Promise<EmailTemplateArtwork> {
  const response = await apiClient.get(`/messaging/templates/artwork/${id}`);
  return response.data;
}
