import type { EmailMediaAsset, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';

export const escapeEmailAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const marker = /<span\b([^>]*\bdata-email-media-id\s*=\s*["']([a-f0-9-]{36})["'][^>]*)>[\s\S]*?<\/span>/gi;

export function pendingHtmlMedia(id: string, alt: string): string {
  return '<span data-email-media-id="'+escapeEmailAttribute(id)+'" data-email-media-alt="'+escapeEmailAttribute(alt)+'" style="display:block;min-height:96px;padding:24px;box-sizing:border-box;text-align:center;border:1px dashed #b9cee9;border-radius:10px;color:#6080a0;">Image loading…</span>';
}

export function htmlEmailMediaIds(draft: EmailWorkspaceDraft): string[] {
  const sources = [draft.body_html ?? '', ...Object.values(draft.content_blocks_json ?? {}).map(block => block.body_html ?? '')];
  return [...new Set(sources.flatMap(source => [...source.matchAll(/\bdata-email-media-id\s*=\s*["']([a-f0-9-]{36})["']/gi)].map(match => match[1])))];
}

export function readyHtmlMedia(draft: EmailWorkspaceDraft, assets: Map<string, EmailMediaAsset>): EmailWorkspaceDraft {
  const replace = (html: string) => html.replace(marker, (original, attrs: string, id: string) => {
    const asset = assets.get(id);
    if (!asset?.url) return original;
    const match = attrs.match(/data-email-media-alt\s*=\s*(["'])(.*?)\1/i);
    const raw = match?.[2] ?? asset.name;
    const entities: Record<string,string> = { '&quot;': '"', '&#039;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };
    const alt = escapeEmailAttribute(raw.replace(/&quot;|&#039;|&lt;|&gt;|&amp;/g, value => entities[value]));
    return '<img src="'+escapeEmailAttribute(asset.url)+'" alt="'+alt.replace(/</g, '&lt;').replace(/>/g, '&gt;')+'" width="520" style="display:block;max-width:100%;height:auto;">';
  });
  const body = replace(draft.body_html ?? '');
  const blocks = Object.fromEntries(Object.entries(draft.content_blocks_json ?? {}).map(([key, block]) => [key, { ...block, body_html: replace(block.body_html ?? '') }]));
  if (body === (draft.body_html ?? '') && JSON.stringify(blocks) === JSON.stringify(draft.content_blocks_json ?? {})) return draft;
  return { ...draft, body_html: body, content_blocks_json: blocks };
}
