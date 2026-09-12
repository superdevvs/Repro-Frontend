import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@/types/messaging';
import { TemplateEditorDialog } from './TemplateEditorDialog';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), preview: vi.fn(), send: vi.fn(), update: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('@/services/messaging', () => ({
  createTemplate: mocks.create, previewTemplate: mocks.preview,
  testSendTemplate: mocks.send, updateTemplate: mocks.update,
}));
vi.mock('@/lib/sonner-toast', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const template: MessageTemplate = {
  id: 12, channel: 'EMAIL', name: 'Account email', category: 'ACCOUNT', scope: 'SYSTEM',
  slug: 'account-created', subject: 'Welcome {{client_name}}',
  body_html: '<!doctype html><html><body><div>Legacy shell</div></body></html>',
  editable_body_html: '<p>Hello {{client_name}}</p>', body_text: 'Hello {{client_name}}',
  is_system: true, is_active: true, email_type: 'ACCOUNT_CREATED', override_enabled: false,
  created_at: '2026-09-13T00:00:00Z', updated_at: '2026-09-13T00:00:00Z',
};
const renderedHtml = '<!doctype html><html><head><style>@media(prefers-color-scheme:dark){body{background:#080f19}}</style></head><body><p>Rendered delivery</p></body></html>';

function setup(value: MessageTemplate | null = template) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  const view = (current: MessageTemplate | null) => (
    <QueryClientProvider client={queryClient}>
      <TemplateEditorDialog template={current} open onClose={onClose} onSuccess={onSuccess} />
    </QueryClientProvider>
  );
  const result = render(view(value));
  return { ...result, onSuccess, onClose, reopen: (saved: MessageTemplate) => result.rerender(view(saved)) };
}

function tab(name: string) {
  const trigger = screen.getByRole('tab', { name });
  fireEvent.mouseDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe('TemplateEditorDialog delivered preview and persistence', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.preview.mockResolvedValue({ subject: 'Welcome Alex', body_html: renderedHtml });
    mocks.send.mockResolvedValue(undefined);
    localStorage.clear();
  });
  afterEach(cleanup);

  it('preserves server styles in a sandbox and previews unsaved body and subject with the same renderer', async () => {
    setup();
    expect(screen.getByLabelText('Email HTML content')).toHaveValue(template.editable_body_html);
    tab('Preview');
    expect(await screen.findByTitle('Delivered email preview')).toHaveAttribute('srcdoc', renderedHtml);
    expect(screen.getByTitle('Delivered email preview')).toHaveAttribute('sandbox', '');
    expect(mocks.preview).toHaveBeenLastCalledWith(12, undefined, expect.objectContaining({
      theme: 'light', template: expect.objectContaining({ email_type: 'ACCOUNT_CREATED', override_enabled: false }),
    }));
    tab('HTML');
    fireEvent.change(screen.getByLabelText('Email HTML content'), { target: { value: '<p>Updated {{client_name}}</p>' } });
    fireEvent.change(screen.getByLabelText('Email Subject *'), { target: { value: 'Updated subject' } });
    tab('Preview');
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith(12, undefined, expect.objectContaining({
      template: expect.objectContaining({ body_html: '<p>Updated {{client_name}}</p>', subject: 'Updated subject' }),
    })));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('requests a deterministic dark theme and changes the iframe viewport without rewriting returned HTML', async () => {
    setup();
    tab('Preview');
    await screen.findByTitle('Delivered email preview');
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith(12, undefined, expect.objectContaining({ theme: 'dark' })));
    fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    const frame = await screen.findByTitle('Delivered email preview');
    expect(frame).toHaveAttribute('width', '375');
    expect(frame).toHaveAttribute('srcdoc', renderedHtml);
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    tab('HTML');
    tab('Preview');
    expect(await screen.findByTitle('Delivered email preview')).toHaveAttribute('width', '375');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('refreshes the preview when override metadata changes without a body edit', async () => {
    setup();
    tab('Preview');
    await screen.findByTitle('Delivered email preview');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use the saved subject and body for this automated email' }));
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith(12, undefined, expect.objectContaining({
      template: expect.objectContaining({ email_type: 'ACCOUNT_CREATED', override_enabled: true }),
    })));
  });

  it('previews a new plain-text draft without saving or inventing a local email shell', async () => {
    setup(null);
    tab('Text');
    fireEvent.change(screen.getByLabelText('Email plain text content'), { target: { value: 'Plain draft {{client_name}}' } });
    tab('Preview');
    await screen.findByTitle('Delivered email preview');
    expect(mocks.preview).toHaveBeenLastCalledWith(null, undefined, expect.objectContaining({
      template: expect.objectContaining({ name: 'Untitled email', body_text: 'Plain draft {{client_name}}', scope: 'USER' }),
    }));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('shows server errors and retries instead of silently displaying a different local layout', async () => {
    mocks.preview.mockRejectedValueOnce({ response: { data: { message: 'Unable to render this content.' } } });
    setup();
    tab('Preview');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to render this content.');
    expect(screen.queryByTitle('Delivered email preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    expect(await screen.findByTitle('Delivered email preview')).toHaveAttribute('srcdoc', renderedHtml);
  });

  it.each([true, false])('saves and reopens editable content with protected=%s without persisting the shell', async (protectedTemplate) => {
    const original = protectedTemplate ? template : { ...template, is_system: false, scope: 'USER' as const, email_type: '', override_enabled: false, variables_json: null };
    const saved = { ...original, subject: 'Edited subject', body_html: '<p>Edited {{client_name}}</p>', editable_body_html: '<p>Edited {{client_name}}</p>', updated_at: '2026-09-13T01:00:00Z' };
    mocks.update.mockResolvedValue(saved);
    const result = setup(original);
    fireEvent.change(screen.getByLabelText('Email Subject *'), { target: { value: saved.subject } });
    fireEvent.change(screen.getByLabelText('Email HTML content'), { target: { value: saved.body_html } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(result.onSuccess).toHaveBeenCalledWith(saved));
    expect(mocks.update).toHaveBeenCalledWith(12, expect.objectContaining({
      subject: saved.subject, body_html: saved.body_html, override_enabled: false, email_type: original.email_type,
    }));
    result.reopen(saved);
    expect(screen.getByLabelText('Email Subject *')).toHaveValue(saved.subject);
    expect(screen.getByLabelText('Email HTML content')).toHaveValue(saved.body_html);
  });

  it('test-sends the current unsaved content and override metadata and reports provider errors', async () => {
    mocks.send.mockRejectedValueOnce({ response: { data: { error: 'Email provider unavailable.' } } });
    setup();
    fireEvent.change(screen.getByLabelText('Email HTML content'), { target: { value: '<p>Unsaved test</p>' } });
    fireEvent.change(screen.getByLabelText('Test email address'), { target: { value: ' reviewer@example.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(12, { to: 'reviewer@example.com', template: expect.objectContaining({
      body_html: '<p>Unsaved test</p>', email_type: 'ACCOUNT_CREATED', override_enabled: false, scope: 'SYSTEM',
    }) }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Email provider unavailable.'));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('inserts a content section at the cursor without introducing an email frame', () => {
    setup();
    const html = screen.getByLabelText<HTMLTextAreaElement>('Email HTML content');
    html.setSelectionRange(html.value.length, html.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Section' }));
    expect(html.value).toContain('<h2>Section title</h2>');
    expect(html.value).toContain('{{client_name}}');
    expect(html.value).not.toMatch(/<html|<body|<style|Legacy shell/i);
  });

  it('retains live report blocks and reinserts missing HTML and text blocks into the correct versions', () => {
    setup({ ...template, slug: 'payout-report', email_type: '', variables_json: ['email_subject', 'payout_report_html', 'payout_report_text'],
      editable_body_html: '{{ payout_report_html }}', body_text: '' });
    expect(screen.getByText(/Your saved content is used automatically/)).toBeInTheDocument();
    expect(screen.queryByText('Automated email override')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Included: payout report' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Email HTML content'), { target: { value: '<p>Custom introduction.</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert: payout report' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Email HTML content').value).toContain('{{payout_report_html}}');
    tab('Text');
    fireEvent.click(screen.getByRole('button', { name: 'Insert: payout report' }));
    expect(screen.getByLabelText('Email plain text content')).toHaveValue('{{payout_report_text}}');
    expect(screen.getByText('{{email_subject}}')).toBeInTheDocument();
  });
});
