import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@/types/messaging';
import { EmailTemplateWorkspace } from './EmailTemplateWorkspace';
import { safeEditorHtml, safeEmailPreview, startingEmail } from './emailWorkspaceModel';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), preview: vi.fn(), send: vi.fn(), suggest: vi.fn(), templates: vi.fn(), navigate: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('@/services/messaging', () => ({ createTemplate: mocks.create, updateTemplate: mocks.update, previewTemplate: mocks.preview, testSendTemplate: mocks.send, getTemplates: mocks.templates }));
vi.mock('@/services/emailTemplateWorkspace', () => ({ suggestEmailTemplate: mocks.suggest, generateEmailArtwork: vi.fn(), getEmailArtwork: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { error: mocks.error, success: mocks.success, info: mocks.info } }));

const template: MessageTemplate = {
  id: 81, ...startingEmail('tips'), is_system: false, is_active: true, created_at: '', updated_at: '',
};
function setup(value: MessageTemplate | null = template) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onSuccess = vi.fn(), onClose = vi.fn();
  return { ...render(<QueryClientProvider client={queryClient}><EmailTemplateWorkspace template={value} open onSuccess={onSuccess} onClose={onClose}/></QueryClientProvider>), onSuccess, onClose };
}
function tab(name: string) { fireEvent.click(screen.getByRole('tab', { name })); }

describe('production email workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.preview.mockResolvedValue({ subject: 'Preview subject', html: '<html><body><p>Rendered email</p></body></html>', source_html: '<p>Unresolved {{client_first_name}}</p>' });
    mocks.templates.mockResolvedValue([template]);
    mocks.update.mockImplementation(async (id, data) => ({ ...template, ...data, id }));
    mocks.create.mockImplementation(async data => ({ ...template, ...data, id: 90 }));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('starts new photographer or client emails without booking context', () => {
    setup(null);
    fireEvent.click(screen.getByRole('button', { name: /Photographer tips/ }));
    expect(screen.getByLabelText('Email subject')).toHaveValue('A few tips for your next shoot');
    expect(screen.getByText('Before you arrive')).toBeInTheDocument();
    expect(screen.getByText('No booking details required')).toBeInTheDocument();
    expect(screen.queryByText('EMAIL DETAILS')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Email preview text')).not.toBeInTheDocument();
  });

  it('manually edits a section, undoes it, and saves without closing the workspace', async () => {
    const view = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Before you arrive' }));
    fireEvent.change(screen.getByLabelText('Tips · one per line'), { target: { value: 'Check your lens.\nArrive early.' } });
    expect(screen.getByText('Check your lens.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('Tips · one per line') as HTMLTextAreaElement).value).toContain('Review the shoot brief');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(view.onSuccess).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(81, expect.objectContaining({ editor_document_json: expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ body: 'Check your lens.\nArrive early.' })]) }) }));
    expect(view.onClose).not.toHaveBeenCalled();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('can save a manual paragraph again after the server returns empty fields as null', async () => {
    mocks.create.mockImplementationOnce(async data => ({ ...template, ...data, id: 90, editor_document_json: {
      ...data.editor_document_json, preheader: null, sections: data.editor_document_json.sections.map(section => ({
        ...section, heading: null, image_url: null, alt: null, url: null,
      })),
    } }));
    setup(null);
    fireEvent.click(screen.getByRole('button', { name: /Start from scratch/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit text section 1' }));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'A plain paragraph without a heading.' } });
    fireEvent.change(screen.getByLabelText('Email subject'), { target: { value: 'Manual client update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('All changes saved');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(90, expect.objectContaining({ editor_document_json: expect.objectContaining({
      preheader: '', sections: expect.arrayContaining([expect.objectContaining({ heading: '', body: 'A plain paragraph without a heading.', image_url: '' })]),
    }) })));
  });

  it('compares a Robbie suggestion, discards or applies it explicitly, and supports undo', async () => {
    setup();
    mocks.suggest.mockResolvedValue({ subject: 'A revised subject', editor_document_json: { ...template.editor_document_json } });
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Improve the subject' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await screen.findByText('Robbie’s suggestion');
    expect(screen.getByLabelText('Email subject')).toHaveValue('A revised subject');
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Original' }));
    expect(screen.getByLabelText('Email subject')).toHaveValue(template.subject);
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByLabelText('Email subject')).toHaveValue('A revised subject');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Email subject')).toHaveValue(template.subject);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('pastes complete HTML, retains original source on save and reopens it', async () => {
    const view = setup(null);
    fireEvent.click(screen.getByRole('button', { name: 'Paste or import HTML instead' }));
    const html = '<!doctype html><html><head><title>New client update</title><style>td{color:navy}</style></head><body><table><tr><td>Latest news</td></tr></table></body></html>';
    fireEvent.change(screen.getByLabelText('Email HTML'), { target: { value: html } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this HTML' }));
    expect(screen.getByLabelText('Email HTML content')).toHaveValue(html);
    fireEvent.change(screen.getByLabelText('Email subject'), { target: { value: 'Our latest news' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(view.onSuccess).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ body_html: html, editor_document_json: expect.objectContaining({ format: 'html' }) }));
    expect(screen.getByLabelText('Email HTML content')).toHaveValue(html);
  });

  it('opens an existing connected template and preserves the live wrapper while editing copy', async () => {
    const connected = { ...template, id: 82, is_system: true, slug: 'account-created', subject: '{{system_subject}}', editable_subject: 'Welcome', body_html: '{{system_body_html}}', editor_document_json: null,
      editable_content_blocks: [{ key: 'account.intro', label: 'Introduction', body_html: '<p>Hello {{client_name}}</p>', body_text: 'Hello {{client_name}}', variables_json: ['client_name'] }] } as MessageTemplate;
    setup(connected);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Introduction' }));
    fireEvent.change(screen.getByLabelText('Section content'), { target: { value: 'Welcome {{client_name}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(82, expect.objectContaining({ subject: '{{system_subject}}', body_html: '{{system_body_html}}', content_blocks_json: { 'account.intro': { body_html: '<p>Welcome {{client_name}}</p>', body_text: 'Welcome {{client_name}}' } } })));
  });

  it('keeps the draft on AI failure and does not save or send', async () => {
    setup(); mocks.suggest.mockRejectedValue(new Error('Unavailable'));
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Rewrite it' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByLabelText('Email subject')).toHaveValue(template.subject);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });

  it('hands the saved template to the existing composer without sending it', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Review & send' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & choose recipients' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/messaging/email/compose', { state: { mode: 'compose', prefillTemplateId: 81 } }));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('tests unsaved edits to an existing template without changing its live saved content', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Email subject'), { target: { value: 'Unsaved test subject' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review & send' }));
    fireEvent.change(screen.getByLabelText('Send a test to'), { target: { value: 'preview@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(81, expect.objectContaining({ to: 'preview@example.com', template: expect.objectContaining({ subject: 'Unsaved test subject' }) })));
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });

  it('changes to HTML source only after editing, preserving personalization tokens', async () => {
    setup(); tab('HTML');
    await waitFor(() => expect(screen.getByLabelText('Email HTML content')).toHaveValue('<p>Unresolved {{client_first_name}}</p>'));
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Email HTML content'), { target: { value: '<p>Updated {{client_first_name}}</p>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(81, expect.objectContaining({ body_html: '<p>Updated {{client_first_name}}</p>', editor_document_json: expect.objectContaining({ format: 'html' }) })));
  });
});

describe('untrusted email markup', () => {
  it('cannot become active markup in the editor', () => {
    const html = safeEditorHtml('<img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Text</a><p style="position:fixed">Copy</p>');
    expect(html).not.toMatch(/onerror|script|href|style=/);
    expect(html).toContain('Copy');
  });
  it('preserves email CSS in a restrictive preview without changing source', () => {
    const source = '<html><head><style>td{color:blue}</style></head><body><form action="https://example.com">Send</form><table><tr><td onclick="alert(1)">News</td></tr></table></body></html>';
    const preview = safeEmailPreview(source);
    expect(preview).toContain('Content-Security-Policy'); expect(preview).toContain("default-src 'none'");
    expect(preview).toContain('td{color:blue}'); expect(preview).toContain('<table>');
    expect(preview).not.toContain('onclick'); expect(preview).not.toContain('<form');
    expect(source).toContain('onclick');
  });
});
