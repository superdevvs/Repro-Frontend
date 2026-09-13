import { beforeEach, describe, expect, it, vi } from 'vitest';
const post = vi.hoisted(() => vi.fn());
vi.mock('./api', () => ({ apiClient: { post } }));
import { previewTemplate, testSendTemplate, type TemplateDraft } from './messaging';

const draft: TemplateDraft = {
  channel: 'EMAIL', name: 'Payment review', subject: 'Payment received for review',
  body_html: '<p>{{payment_amount}}</p>', body_text: '{{payment_amount}}',
  scope: 'SYSTEM', email_type: 'OFFLINE_PAYMENT_INTENT_SUBMITTED', override_enabled: true,
  content_blocks_json: { payment_review: { body_html: '<p>We are reviewing your payment.</p>', body_text: 'We are reviewing your payment.' } },
};

describe('template preview API contract', () => {
  beforeEach(() => { post.mockReset(); post.mockResolvedValue({ data: { body_html: '<html></html>' } }); });
  it('supports existing compose previews and saved draft previews without changing the variable payload', async () => {
    await previewTemplate(14, { client_name: 'Alex' });
    expect(post).toHaveBeenLastCalledWith('/messaging/templates/14/preview', { variables: { client_name: 'Alex' } });
    await previewTemplate(14, undefined, { template: draft, theme: 'dark' });
    expect(post).toHaveBeenLastCalledWith('/messaging/templates/14/preview', { variables: undefined, template: draft, theme: 'dark' });
  });
  it('routes an unsaved preview without an ID and sends the same draft metadata to test-send', async () => {
    await previewTemplate(null, undefined, { template: draft, theme: 'light' });
    expect(post).toHaveBeenLastCalledWith('/messaging/templates/preview', { variables: undefined, template: draft, theme: 'light' });
    await testSendTemplate(14, { to: 'reviewer@example.com', template: draft });
    expect(post).toHaveBeenLastCalledWith('/messaging/templates/14/test-send', { to: 'reviewer@example.com', template: draft });
  });
});
