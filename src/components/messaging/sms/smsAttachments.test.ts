import { describe, expect, it } from 'vitest';
import {
  MAX_SMS_ATTACHMENT_BYTES,
  formatFileSize,
  isInlineImage,
  safeAttachmentName,
  selectAttachments,
  smsSnippetPreview,
  splitAttachmentLink,
} from './smsAttachments';

const file = (name: string, size: number, type = 'image/jpeg') => {
  const value = new File(['x'], name, { type });
  Object.defineProperty(value, 'size', { value: size });
  return value;
};
const link = 'https://api.reprodashboard.com/api/messaging/media/bundle/5f0c2f6e-8d3b-4a53-9c38-1c4f1f6f2a10?expires=1797000000&signature=abc123';

describe('SMS attachment limits', () => {
  it('accepts files up to exactly 1 GB and explains empty or larger files by name', () => {
    const result = selectAttachments([
      file('ok.jpg', MAX_SMS_ATTACHMENT_BYTES),
      file('huge.mov', MAX_SMS_ATTACHMENT_BYTES + 1, 'video/quicktime'),
      file('blank.pdf', 0, 'application/pdf'),
    ], 0);

    expect(result.accepted.map(entry => entry.name)).toEqual(['ok.jpg']);
    expect(result.errors).toEqual([
      'huge.mov is 1.0 GB. Attachments can be up to 1 GB each.',
      'blank.pdf is empty, so it was not attached.',
    ]);
  });

  it('keeps a message to ten attachments counting the ones already attached', () => {
    const result = selectAttachments([file('a.jpg', 10), file('b.jpg', 10), file('c.jpg', 10)], 8);

    expect(result.accepted.map(entry => entry.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(result.errors).toEqual(['A message can carry up to 10 attachments. 1 file was left out.']);
  });

  it('accepts any file type because the server scans every upload', () => {
    expect(selectAttachments([file('plan.dwg', 5000, 'application/acad'), file('notes', 12, '')], 0).errors).toEqual([]);
  });
});

describe('attachment names and sizes', () => {
  it('removes characters the API refuses and shortens long names without losing the extension', () => {
    expect(safeAttachmentName('front/door\\photo\u0007.jpg')).toBe('front_door_photo_.jpg');
    const long = safeAttachmentName(`${'a'.repeat(300)}.jpeg`);
    expect(long).toHaveLength(200);
    expect(long.endsWith('.jpeg')).toBe(true);
    expect(safeAttachmentName('   ')).toBe('Attachment');
  });

  it('formats sizes for people', () => {
    expect([formatFileSize(0), formatFileSize(900), formatFileSize(350 * 1024), formatFileSize(4.25 * 1024 * 1024), formatFileSize(48 * 1024 * 1024)])
      .toEqual(['', '900 B', '350 KB', '4.3 MB', '48 MB']);
  });

  it('shows only browser-safe pictures inline and leaves very large ones as downloads', () => {
    const base = { preview_url: '/api/messaging/media/files/1?preview=1', size: 2_000_000 };
    expect(isInlineImage({ ...base, type: 'image/jpeg' })).toBe(true);
    expect(isInlineImage({ ...base, type: 'image/svg+xml' })).toBe(false);
    expect(isInlineImage({ ...base, type: 'application/pdf' })).toBe(false);
    expect(isInlineImage({ ...base, type: 'image/png', size: 31 * 1024 * 1024 })).toBe(false);
    expect(isInlineImage({ type: 'image/png', size: 10, preview_url: undefined })).toBe(false);
  });
});

describe('the attachment link the API appends to a sent text', () => {
  it('separates the written text from the link', () => {
    expect(splitAttachmentLink(`Here are the floor plans.\n\nAttachments (2)\n${link}`)).toEqual({ text: 'Here are the floor plans.', count: 2 });
    expect(splitAttachmentLink(`Attachments (1)\n${link}`)).toEqual({ text: '', count: 1 });
  });

  it('leaves ordinary messages and unrelated links alone', () => {
    const plain = 'Attachments (2) are in your email https://reprodashboard.com/shoots/2474';
    expect(splitAttachmentLink(plain)).toEqual({ text: plain, count: 0 });
    expect(splitAttachmentLink('See you at 3')).toEqual({ text: 'See you at 3', count: 0 });
  });

  it('names attachments in the conversation preview instead of showing the link', () => {
    expect(smsSnippetPreview(`Floor plans attached\n\nAttachments (2)\n${link}`, true)).toBe('Floor plans attached · 2 attachments');
    expect(smsSnippetPreview(`Attachments (1)\n${link.slice(0, 60)}...`, true)).toBe('Attachment');
    expect(smsSnippetPreview('On my way', true)).toBe('On my way');
  });

  it('labels a received picture without text, and stays empty for a conversation with no messages', () => {
    expect(smsSnippetPreview('', true)).toBe('Attachment');
    expect(smsSnippetPreview(undefined, false)).toBe('');
  });
});
