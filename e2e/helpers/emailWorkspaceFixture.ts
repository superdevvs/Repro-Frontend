import type { Page } from '@playwright/test';
import type { MessageTemplate } from '../../src/types/messaging';

/** In-memory template API. Acceptance never edits live templates or sends mail. */
export async function emailWorkspaceFixture(page: Page) {
  const sections = [{ id: 'intro', type: 'text' as const, heading: 'Field notes', body: 'Check your batteries before the shoot.', image_url: '', alt: '', url: '', alignment: 'left' as const, spacing: 24 }];
  const initial: MessageTemplate = { id: 88001, channel: 'EMAIL', name: 'Photographer field notes', subject: 'Prepare for your next shoot', category: 'GENERAL', scope: 'USER', body_html: '<p>Check your batteries before the shoot.</p>', body_text: 'Check your batteries before the shoot.', is_system: false, is_active: true, created_at: '', updated_at: '', editor_document_json: { version: 1, format: 'sections', preheader: 'A little preparation helps.', sections } };
  const system: MessageTemplate = { ...initial, id: 88002, name: 'Connected account welcome', slug: 'account-created', scope: 'SYSTEM', is_system: true, subject: '{{system_subject}}', editable_subject: 'Welcome to REPRO', body_html: '{{system_body_html}}', body_text: '{{system_body_text}}', email_type: 'ACCOUNT_CREATED', override_enabled: true, editor_document_json: null, editable_content_blocks: [{ key: 'account.intro', label: 'Introduction', body_html: '<p>Welcome {{client_name}}</p>', body_text: 'Welcome {{client_name}}', variables_json: ['client_name'] }] };
  const templates = [structuredClone(initial), structuredClone(system)];
  const writes: { method: string; payload: Partial<MessageTemplate> }[] = [];
  let sends = 0;
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  function source(template: Partial<MessageTemplate>) {
    if (template.editor_document_json?.format === 'sections') return '<html><body>'+template.editor_document_json.sections.map(section => '<h2>'+escape(section.heading)+'</h2><p>'+escape(section.body)+'</p>').join('')+'</body></html>';
    if (template.editable_content_blocks?.length) return '<html><body>'+template.editable_content_blocks.map(block => template.content_blocks_json?.[block.key]?.body_html ?? block.body_html).join('')+'</body></html>';
    return template.body_html ?? '';
  }
  await page.route('**/api/messaging/templates**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const id = Number(path.match(/templates\/(\d+)/)?.[1]);
    const current = templates.find(item => item.id === id);
    if (request.method() === 'GET') { await route.fulfill({ json: current ?? templates }); return; }
    const payload = request.postDataJSON() ?? {};
    if (path.endsWith('/preview')) {
      const draft = { ...current, ...payload.template };
      await route.fulfill({ json: { subject: draft.subject, html: source(draft).replaceAll('{{client_name}}', 'Alex'), source_html: source(draft), missing: [] } }); return;
    }
    if (path.endsWith('/assist')) { await route.fulfill({ json: { draft: { ...payload.draft, subject: 'A warmer subject from Robbie' } } }); return; }
    if (path.endsWith('/test-send')) { sends++; await route.fulfill({ status: 400, json: { message: 'Sending is disabled in this fixture.' } }); return; }
    writes.push({ method: request.method(), payload });
    const saved = { ...(current ?? initial), ...payload, id: current?.id ?? 88000+templates.length+1, editable_subject: payload.subject, updated_at: new Date().toISOString() };
    if (current) Object.assign(current, saved); else templates.push(saved);
    await route.fulfill({ status: current ? 200 : 201, json: saved });
  });
  return { templates, writes, get sends() { return sends; } };
}
