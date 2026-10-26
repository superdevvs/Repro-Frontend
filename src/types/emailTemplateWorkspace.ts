import type { MessageTemplate } from './messaging';

export interface EmailTemplateSection {
  id: string;
  type: 'text' | 'tips' | 'notice' | 'image' | 'button' | 'divider' | 'hero' | 'feature' | 'steps' | 'details' | 'columns' | 'video' | 'quote' | 'spacer' | 'signature' | 'faq' | 'offer';
  columns?: EmailTemplateSection[][];
  rich_text?: import('@tiptap/core').JSONContent;
  media_id?: string;
  video_url?: string;
  duration?: string;
  caption?: string;
  image_link?: string;
  styles?: { color?: string; background?: string; font_size?: number; padding?: number; radius?: number; fit?: 'contain' | 'cover'; aspect?: 'auto' | '1:1' | '3:2' | '16:9' | '12:5'; focal_x?: number; focal_y?: number };
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
  version: 1 | 2;
  format: 'sections' | 'html' | 'legacy';
  preheader: string;
  sections: EmailTemplateSection[];
}

export type EmailWorkspaceDraft = Pick<MessageTemplate,
  'name' | 'description' | 'category' | 'subject' | 'body_html' | 'body_text' | 'scope' | 'email_type' | 'override_enabled' | 'content_blocks_json'
> & { workspace_revision?: number; channel: 'EMAIL'; editor_document_json: EmailEditorDocument };

export type EmailArtworkKind = 'illustration' | 'icon' | 'header';
export interface EmailTemplateArtwork {
  id: string;
  kind: EmailArtworkKind;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'unknown';
  url: string | null;
  error: string | null;
}

export interface EmailAssistantContext {
  message?: string;
  needs_input?: string[];
  model: string;
  sources: { id: string; title: string; url: string }[];
}
export type EmailTemplateProposal = Partial<EmailWorkspaceDraft> & { assistant_context?: EmailAssistantContext };

export interface EmailMediaAsset {
  id: string; name: string; source: 'uploaded' | 'generated' | 'dashboard' | 'video-thumbnail'; status: 'processing' | 'ready' | 'failed';
  legacy?: boolean; url: string | null; mime: string | null; original_bytes: number; bytes: number; width: number; height: number; error: string | null;
}
export interface EmailAssetOptions { slot?: 'header' | 'content' | 'icon'; quality?: 'balanced' | 'high'; crop?: string; focal_x?: number; focal_y?: number; play?: boolean }
export interface EmailDashboardMedia { id: string; shoot_id: number; unit_id?: number | null; name: string; url: string; video_url: string | null; watch_url: string | null }
export interface EmailServerDraft { id: string; revision: number; draft: EmailWorkspaceDraft; updated_at?: string }
