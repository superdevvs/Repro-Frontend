import { describe, expect, it } from 'vitest';
import { htmlEmailMediaIds, pendingHtmlMedia, readyHtmlMedia } from './emailWorkspaceHtmlMedia';
import { startingEmail } from './emailWorkspaceModel';
import type { EmailMediaAsset } from '@/types/emailTemplateWorkspace';

const id = '550e8400-e29b-41d4-a716-446655440000';
const asset = { id, name: 'House', status: 'ready', url: 'https://example.com/photo.png' } as EmailMediaAsset;

describe('HTML background media', () => {
  it('recovers stable markers from saved source and replaces only the image when ready', () => {
    const marker = pendingHtmlMedia(id, 'House "<view>" & garden');
    const source = '<html><head><style>.custom{color:red}</style></head><body><!-- keep --><table><tr><td>Keep my layout</td></tr></table>'+marker+'</body></html>';
    const draft = { ...startingEmail('blank'), body_html: source, content_blocks_json: { intro: { body_html: marker, body_text: 'Keep text' } } };
    expect(htmlEmailMediaIds(draft)).toEqual([id]);
    expect(readyHtmlMedia(draft, new Map())).toBe(draft);
    const ready = readyHtmlMedia(draft, new Map([[id, asset]]));
    expect(ready.body_html).toContain('<style>.custom{color:red}</style>');
    expect(ready.body_html).toContain('<!-- keep -->');
    expect(ready.body_html).toContain('<table><tr><td>Keep my layout</td></tr></table>');
    expect(ready.body_html).toContain('alt="House &quot;&lt;view&gt;&quot; &amp; garden"');
    expect(ready.body_html).toContain(asset.url);
    expect(ready.content_blocks_json?.intro.body_text).toBe('Keep text');
    expect(htmlEmailMediaIds(ready)).toEqual([]);
    expect(readyHtmlMedia(ready, new Map([[id, asset]]))).toBe(ready);
  });
});
