import type { MessageTemplate } from './messaging';

export interface EmailTemplateSection {
  id: string;
  type: 'text' | 'tips' | 'notice' | 'image' | 'button' | 'divider' | 'hero' | 'feature' | 'steps' | 'details';
  heading: string;
  body: string;
  image_url: string;
  alt: string;
  url: string;
  alignment: 'left' | 'center' | 'right';
  spacing: number;
  eyebrow?: string;
  layout?: 'stacked' | 'image-left' | 'image-right';
  tone?: 'plain' | 'soft' | 'accent';
  image_width?: number;
  image_prompt?: string;
  artwork_id?: string | null;
  artwork_key?: string;
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

export type EmailArtworkKind = 'illustration' | 'icon' | 'header';
export interface EmailTemplateArtwork {
  id: string;
  kind: EmailArtworkKind;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'unknown';
  url: string | null;
  error: string | null;
}

export interface EmailAssistantContext {
  model: string;
  sources: { id: string; title: string; url: string }[];
}
export type EmailTemplateProposal = Partial<EmailWorkspaceDraft> & { assistant_context?: EmailAssistantContext };
