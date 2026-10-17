import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@/types/messaging';
import { EmailTemplateWorkspace } from './EmailTemplateWorkspace';
import { safeEditorHtml, safeEmailPreview, startingEmail, newSection } from './emailWorkspaceModel';

const mocks = vi.hoisted(() => ({ mobile: false, tablet: false, generate: vi.fn(), artwork: vi.fn(), create: vi.fn(), update: vi.fn(), preview: vi.fn(), send: vi.fn(), suggest: vi.fn(), templates: vi.fn(), navigate: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => mocks.tablet }));
vi.mock('@/services/messaging', () => ({ createTemplate: mocks.create, updateTemplate: mocks.update, previewTemplate: mocks.preview, testSendTemplate: mocks.send, getTemplates: mocks.templates }));
vi.mock('@/services/emailTemplateWorkspace', () => ({ suggestEmailTemplate: mocks.suggest, generateEmailArtwork: mocks.generate, getEmailArtwork: mocks.artwork }));
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
function tab(name: string) { fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false }); }

describe('production email workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.mobile = false; mocks.tablet = false; localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true);
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

  it('keeps a complete document pasted into an existing custom template in its original style', async () => {
    setup({ ...template, editor_document_json: null }); tab('HTML');
    const html = '<!doctype html><html><head><style>p{color:teal}</style></head><body><p>New client information</p></body></html>';
    fireEvent.change(screen.getByLabelText('Email HTML content'), { target: { value: html } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(81, expect.objectContaining({ body_html: html, editor_document_json: expect.objectContaining({ format: 'html' }) })));
  });

  it('lets Robbie edit an existing unstructured message from its section editor', async () => {
    setup({ ...template, editor_document_json: null }); mocks.suggest.mockResolvedValue({ subject: template.subject });
    fireEvent.click(screen.getByRole('button', { name: 'Edit message content' }));
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie about this section/ }));
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Make this message warmer.' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await waitFor(() => expect(mocks.suggest).toHaveBeenCalledWith(expect.objectContaining({ scope: 'email' })));
  });

  it('switches mobile editor modes and Robbie without losing the draft', async () => {
    mocks.mobile = true; setup();
    expect(screen.queryByRole('complementary', { name: 'Robbie assistant' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email subject'), { target: { value: 'My client update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Robbie assistant' }));
    expect(screen.getByRole('complementary', { name: 'Robbie assistant' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Email editor' })).not.toBeInTheDocument();
    tab('HTML');
    await screen.findByLabelText('Email HTML content');
    expect(screen.getByLabelText('Email subject')).toHaveValue('My client update');
    tab('Edit email');
    expect(screen.getByRole('button', { name: 'Edit Before you arrive' })).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps the selected section when moving from the mobile section panel to Robbie', async () => {
    mocks.mobile = true; setup(); mocks.suggest.mockResolvedValue({ subject: template.subject });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Before you arrive' }));
    expect(screen.getByRole('dialog', { name: 'Edit email section' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Tips · one per line'), { target: { value: 'Bring a spare battery.' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie about this section/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit email section' })).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Add a lens cleaning tip.' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await waitFor(() => expect(mocks.suggest).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'section', section_id: template.editor_document_json!.sections.find(section => section.type === 'tips')!.id,
    })));
    await screen.findByText('Robbie’s suggestion');
    expect(screen.getByText('Bring a spare battery.')).toBeVisible();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('opens existing templates and HTML import from the mobile actions menu', async () => {
    mocks.mobile = true; setup(); const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Template actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open template' }));
    expect(await screen.findByRole('dialog', { name: 'Open an existing template' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Photographer field notes/ }));
    await user.click(screen.getByRole('button', { name: 'Template actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import HTML' }));
    expect(await screen.findByRole('dialog', { name: 'Paste or import HTML' })).toBeVisible();
    expect(screen.getByLabelText('Email HTML')).toBeEnabled();
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });

  it('can collapse the desktop assistant and changes only the delivered preview theme', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Robbie assistant' }));
    expect(screen.queryByRole('complementary', { name: 'Robbie assistant' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Email preview appearance' })).not.toBeInTheDocument();
    tab('Preview');
    await screen.findByTitle('Delivered email preview');
    fireEvent.click(screen.getByRole('button', { name: 'Preview dark email' }));
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith(81, undefined, expect.objectContaining({ theme: 'dark' })));
    expect(screen.getByLabelText('Email subject')).toHaveValue(template.subject);
    tab('Edit email');
    expect(screen.queryByRole('button', { name: 'Preview light email' })).not.toBeInTheDocument();
  });

  it('uses a focused section dialog on tablets and keeps manual edits when it closes', async () => {
    mocks.tablet = true; setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Before you arrive' }));
    expect(screen.getByRole('dialog', { name: 'Edit email section' })).toHaveAttribute('data-mobile', 'false');
    fireEvent.change(screen.getByLabelText('Tips · one per line'), { target: { value: 'Pack a spare memory card.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close section editor' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit email section' })).not.toBeInTheDocument());
    expect(screen.getByText('Pack a spare memory card.')).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('inserts personal fields without leaving the mobile section editor', async () => {
    mocks.mobile = true; setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Before you arrive' }));
    const message = screen.getByLabelText('Tips · one per line') as HTMLTextAreaElement;
    fireEvent.change(message, { target: { value: 'Hello ' } });
    message.focus(); message.setSelectionRange(6, 6); fireEvent.select(message);
    fireEvent.click(screen.getByRole('button', { name: 'Insert personal field' }));
    fireEvent.click(screen.getByRole('button', { name: '{{client_name}}' }));
    await waitFor(() => expect(screen.getByLabelText('Tips · one per line')).toHaveValue('Hello {{client_name}}'));
    expect(screen.getByRole('dialog', { name: 'Edit email section' })).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('adds image-and-text layouts and formats selected copy without losing manual controls', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Before you arrive' }));
    fireEvent.change(screen.getByLabelText('Section layout'), { target: { value: 'feature' } });
    fireEvent.change(screen.getByLabelText('Image position'), { target: { value: 'image-left' } });
    const field = screen.getByLabelText('Message') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'Review your invoice.' } });
    field.focus(); field.setSelectionRange(0, 6);
    fireEvent.click(screen.getByRole('button', { name: 'Bold text' }));
    expect(field).toHaveValue('**Review** your invoice.');
    expect(screen.getByText('Review', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(81, expect.objectContaining({ editor_document_json: expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ type: 'feature', layout: 'image-left', body: '**Review** your invoice.' })]) }) })));
  });

  it('can format a text link using a connected recipient field', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('{{portal_url}}');
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Before you arrive' }));
    const field = screen.getByLabelText('Tips · one per line') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'Open your invoice' } });
    field.focus(); field.setSelectionRange(0, field.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Add text link' }));
    expect(field).toHaveValue('[Open your invoice]({{portal_url}})');
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('shows a designed Robbie proposal with dashboard sources and generated artwork in place', async () => {
    const image = { ...newSection('feature'), id: 'invoice-feature', heading: 'Review your invoice', body: 'Open **Earnings**.', image_url: 'https://example.com/brand.png', alt: 'Blue invoice illustration', image_prompt: 'Blue glass invoice', artwork_id: '550e8400-e29b-41d4-a716-446655440000' };
    mocks.suggest.mockResolvedValue({ subject: 'Review and submit your invoice', editor_document_json: { version: 1, format: 'sections', preheader: 'A simple guide', sections: [image] }, assistant_context: { model: 'gpt-6-astra', sources: [{ id: 'photographer-invoice-review', title: 'Review and submit a photographer weekly invoice', url: 'https://reprodashboard.com/help' }] } });
    mocks.generate.mockResolvedValue({ id: image.artwork_id, kind: 'icon', status: 'completed', url: 'https://example.com/generated.png', error: null });
    setup();
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Create a photographer invoice guide' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await screen.findByText('Robbie’s suggestion');
    expect(screen.getByRole('tab', { name: 'Preview' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith({ id: image.artwork_id, kind: 'icon', prompt: 'Blue glass invoice' }));
    await screen.findByText(/Your generated artwork is in place/);
    expect(screen.getByRole('link', { name: 'Review and submit a photographer weekly invoice', hidden: true })).toHaveAttribute('href', 'https://reprodashboard.com/help');
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    expect(screen.getByRole('img', { name: 'Blue invoice illustration' })).toHaveAttribute('src', 'https://example.com/generated.png');
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });

  it('lets the user edit while an applied suggestion generates its image in the background', async () => {
    const image = { ...newSection('feature'), id: 'bg-image', heading: 'Check your invoice', body: 'Original guidance', image_url: 'https://example.com/brand.png', alt: 'Invoice artwork', image_prompt: 'A blue invoice icon', artwork_id: '550e8400-e29b-41d4-a716-446655440001' };
    let finish!: (value: unknown) => void;
    mocks.generate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mocks.suggest.mockResolvedValue({ editor_document_json: { version: 1, format: 'sections', preheader: '', sections: [image] } });
    setup();
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Design my email' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await screen.findByText('Robbie’s suggestion');
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Check your invoice' }));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'My manual invoice guidance' } });
    finish({ id: image.artwork_id, status: 'completed', url: 'https://example.com/ready.png', error: null });
    await waitFor(() => expect(screen.getByRole('img', { name: 'Invoice artwork' })).toHaveAttribute('src', 'https://example.com/ready.png'));
    expect(screen.getByLabelText('Message')).toHaveValue('My manual invoice guidance');
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });

  it('keeps a finished image as an unsaved change when it arrives during a save', async () => {
    const image = { ...newSection('feature'), id: 'saving-image', heading: 'Invoice guide', body: 'Review in Earnings', image_url: 'https://example.com/brand.png', alt: 'Invoice artwork', image_prompt: 'Blue invoice', artwork_id: '550e8400-e29b-41d4-a716-446655440003' };
    let finishImage!: (value: unknown) => void;
    let finishSave!: () => void;
    mocks.generate.mockReturnValue(new Promise(resolve => { finishImage = resolve; }));
    mocks.suggest.mockResolvedValue({ editor_document_json: { version: 1, format: 'sections', preheader: '', sections: [image] } });
    mocks.update.mockImplementation((id, data) => new Promise(resolve => { finishSave = () => resolve({ ...template, ...data, id }); }));
    setup();
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Design an invoice guide' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await screen.findByText('Robbie’s suggestion');
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    finishImage({ id: image.artwork_id, status: 'completed', url: 'https://example.com/finished.png', error: null });
    finishSave();
    await waitFor(() => expect(screen.getByRole('img', { name: 'Invoice artwork' })).toHaveAttribute('src', 'https://example.com/finished.png'));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('never overwrites an image the user replaces while a suggested generation is running', async () => {
    const image = { ...newSection('feature'), id: 'replace-image', heading: 'My guide', body: 'Helpful copy', image_url: 'https://example.com/brand.png', alt: 'Invoice artwork', image_prompt: 'Blue icon', artwork_id: '550e8400-e29b-41d4-a716-446655440002' };
    let finish!: (value: unknown) => void;
    mocks.generate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    mocks.suggest.mockResolvedValue({ editor_document_json: { version: 1, format: 'sections', preheader: '', sections: [image] } });
    setup();
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Design my email' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await screen.findByText('Robbie’s suggestion');
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit My guide' }));
    fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/my-choice.png' } });
    finish({ id: image.artwork_id, status: 'completed', url: 'https://example.com/late-result.png', error: null });
    await waitFor(() => expect(screen.getByLabelText('Image URL')).toHaveValue('https://example.com/my-choice.png'));
    expect(screen.getByRole('img', { name: 'Invoice artwork' })).toHaveAttribute('src', 'https://example.com/my-choice.png');
    expect(mocks.update).not.toHaveBeenCalled();
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
