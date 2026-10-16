import type { MessageTemplate } from './messaging';

export interface EmailTemplateSection {
  id: string;
  type: 'text' | 'tips' | 'notice' | 'image' | 'button' | 'divider';
  heading: string;
  body: string;
  image_url: string;
  alt: string;
  url: string;
  alignment: 'left' | 'center' | 'right';
  spacing: number;
}

export interface EmailEditorDocument {
  version: 1;
  format: 'sections' | 'html' | 'legacy';
  preheader: string;
  sections: EmailTemplateSection[];
}

export type EmailWorkspaceDraft = Pick<MessageTemplate,
  'name' | 'description' | 'category' | 'subject' | 'body_html' | 'body_text' | 'scope' | 'email_type' | 'override_enabled' | 'content_blocks_json'
> & { channel: 'EMAIL'; editor_document_json: EmailEditorDocument };

export interface EmailTemplateArtwork {
  id: string;
  kind: 'illustration' | 'icon';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'unknown';
  url: string | null;
  error: string | null;
}
