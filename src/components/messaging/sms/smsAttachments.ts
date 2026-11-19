import type { MessageMediaFile } from '@/services/messageMedia';

/** Mirrors MessageMediaService::MAX_FILES / MAX_BYTES; the API stays authoritative. */
export const MAX_SMS_ATTACHMENTS = 10;
export const MAX_SMS_ATTACHMENT_BYTES = 1024 * 1024 * 1024;
/** Larger pictures stay a download link so a thread never pulls huge originals. */
export const MAX_INLINE_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_NAME_LENGTH = 200;
const INLINE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/** The API rejects path separators, control characters and names over 200 characters. */
export const safeAttachmentName = (name: string): string => {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim() || 'Attachment';
  if (cleaned.length <= MAX_NAME_LENGTH) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const extension = dot > 0 && cleaned.length - dot <= 12 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, MAX_NAME_LENGTH - extension.length) + extension;
};

export interface AttachmentSelection {
  accepted: File[];
  errors: string[];
}

/** Applies the per-message limits before anything is uploaded. */
export const selectAttachments = (files: File[], alreadyAttached: number): AttachmentSelection => {
  const accepted: File[] = [];
  const errors: string[] = [];
  let overLimit = 0;
  for (const file of files) {
    if (file.size === 0) {
      errors.push(`${file.name} is empty, so it was not attached.`);
    } else if (file.size > MAX_SMS_ATTACHMENT_BYTES) {
      errors.push(`${file.name} is ${formatFileSize(file.size)}. Attachments can be up to 1 GB each.`);
    } else if (alreadyAttached + accepted.length >= MAX_SMS_ATTACHMENTS) {
      overLimit += 1;
    } else {
      accepted.push(file);
    }
  }
  if (overLimit > 0) {
    errors.push(`A message can carry up to ${MAX_SMS_ATTACHMENTS} attachments. ${overLimit} ${overLimit === 1 ? 'file was' : 'files were'} left out.`);
  }
  return { accepted, errors };
};

export const isInlineImage = (file: Pick<MessageMediaFile, 'type' | 'size' | 'preview_url'>): boolean =>
  Boolean(file.preview_url) && INLINE_IMAGE_TYPES.has(file.type) && file.size <= MAX_INLINE_IMAGE_BYTES;

export const isPreviewableLocalImage = (file: File): boolean =>
  INLINE_IMAGE_TYPES.has(file.type) && file.size <= MAX_INLINE_IMAGE_BYTES;

// Outbound attachments travel as one secure link the API appends to the text:
// "<text>\n\nAttachments (2)\nhttps://…/messaging/media/bundle/<id>?…".
const LINK_BLOCK = /(?:^|\s+)Attachments \((\d+)\)\s+https?:\/\/\S*\/messaging\/media\/bundle\/\S*\s*$/;
// Conversation previews are cut at 200 characters, so the link may be clipped.
const SNIPPET_BLOCK = /(?:^|\s+)Attachments \((\d+)\)\s+https?:\/\/\S*\s*$/;

/** Splits the staff-written text from the appended attachment link. */
export const splitAttachmentLink = (body: string): { text: string; count: number } => {
  const match = LINK_BLOCK.exec(body);
  if (!match) return { text: body, count: 0 };
  return { text: body.slice(0, match.index).trimEnd(), count: Number(match[1]) };
};

const countLabel = (count: number) => (count === 1 ? 'Attachment' : `${count} attachments`);

/** One-line conversation preview that names attachments instead of showing a link. */
export const smsSnippetPreview = (snippet: string | undefined, hasMessages: boolean): string => {
  const value = (snippet ?? '').trim();
  if (!value) return hasMessages ? 'Attachment' : '';
  const match = SNIPPET_BLOCK.exec(value);
  if (!match) return value;
  const text = value.slice(0, match.index).trim();
  return text ? `${text} · ${countLabel(Number(match[1]))}` : countLabel(Number(match[1]));
};
