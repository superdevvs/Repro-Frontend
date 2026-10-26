import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailMediaAsset } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { EmailTemplateWorkspace } from './EmailTemplateWorkspace';
import { startingEmail } from './emailWorkspaceModel';

const api = vi.hoisted(() => ({ upload: vi.fn(), asset: vi.fn(), update: vi.fn(), test: vi.fn(), suggest: vi.fn(), navigate: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('react-router-dom', () => ({ useNavigate: () => api.navigate }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { info: api.info, error: api.error, success: vi.fn() } }));
vi.mock('@/services/messaging', () => ({ updateTemplate: api.update, createTemplate: vi.fn(), testSendTemplate: api.test, previewTemplate: async () => ({ html: '<p>Email preview</p>' }), getTemplates: async () => [] }));
vi.mock('@/services/emailTemplateWorkspace', () => ({ suggestEmailTemplate: api.suggest, generateEmailArtwork: vi.fn(), getEmailArtwork: vi.fn() }));
vi.mock('@/services/emailWorkspaceV2', () => ({
  emailWorkspaceCapabilities: async () => ({ enabled: true, version: 2 }), listEmailAssets: async () => ({ data: [], last_page: 1 }),
  uploadEmailAsset: api.upload, getEmailAsset: api.asset, loadEmailServerDraft: async () => null,
  saveEmailServerDraft: async (id: string, revision: number) => ({ id, revision: revision + 1 }), deleteEmailServerDraft: async () => ({}),
  getEmailRevisions: async () => [], listEmailSavedSections: async () => [],
}));

const template = { ...startingEmail('tips'), id: 84, workspace_revision: 0, is_active: true, is_system: false, created_at: '', updated_at: '' } as MessageTemplate;
const pending: EmailMediaAsset = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'New property photo', source: 'uploaded', status: 'processing', url: null, mime: 'image/jpeg', original_bytes: 2000000, bytes: 0, width: 1200, height: 800, error: null };
const ready: EmailMediaAsset = { ...pending, status: 'ready', url: 'https://example.com/optimized.jpg', bytes: 120000 };
const file = () => new File(['photograph'], 'property.jpg', { type: 'image/jpeg' });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><EmailTemplateWorkspace template={template} open onSuccess={vi.fn()} onClose={vi.fn()}/></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-image');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  api.update.mockImplementation(async (id, draft) => ({ ...template, ...draft, id }));
  api.test.mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('media transfer delivery guards', () => {
  it('keeps sending and Robbie blocked after Escape while upload and optimization finish, with editing available', async () => {
    let finishUpload!: (asset: EmailMediaAsset) => void;
    let finishOptimization!: (asset: EmailMediaAsset) => void;
    api.upload.mockReturnValue(new Promise<EmailMediaAsset>(resolve => { finishUpload = resolve; }));
    api.asset.mockReturnValue(new Promise<EmailMediaAsset>(resolve => { finishOptimization = resolve; }));
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Media' }));
    await userEvent.upload(screen.getByLabelText('Upload email image'), file());
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Images & video' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Images & video' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Review & send' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Email subject'), { target: { value: 'Edited while uploading' } });
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Make this warmer' } });
    expect(screen.getByRole('button', { name: /Ask Robbie ↑/ })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText('Ask Robbie'), { key: 'Enter', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.suggest).not.toHaveBeenCalled(); expect(api.test).not.toHaveBeenCalled(); expect(api.update).not.toHaveBeenCalled();
    await act(async () => { finishUpload(pending); });
    await waitFor(() => expect(api.asset).toHaveBeenCalledWith(pending.id, 84));
    expect(screen.getByRole('button', { name: 'Review & send' })).toBeDisabled();
    expect(screen.getByLabelText('Email subject')).toHaveValue('Edited while uploading');
    await act(async () => { finishOptimization(ready); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review & send' })).toBeEnabled());
    expect(screen.getByRole('button', { name: /Ask Robbie ↑/ })).toBeEnabled();
    expect(screen.getByLabelText('Email subject')).toHaveValue('Edited while uploading');
    fireEvent.click(screen.getByRole('button', { name: 'Review & send' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Send a test to' }), { target: { value: 'internal@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => expect(api.test).toHaveBeenCalledWith(84, expect.objectContaining({ to: 'internal@example.com' })));
  });

  it('blocks a canvas transfer before it has an asset ID and resumes recipient review after it attaches', async () => {
    let finishUpload!: (asset: EmailMediaAsset) => void;
    api.upload.mockReturnValue(new Promise<EmailMediaAsset>(resolve => { finishUpload = resolve; }));
    api.asset.mockResolvedValue(ready);
    setup(); await screen.findByRole('button', { name: 'Media' });
    // Files dropped on a section enter the same transfer path as clipboard paste.
    const section = screen.getAllByRole('button', { name: /^Edit / })[0];
    fireEvent.drop(section, { dataTransfer: { files: [file()] } });
    expect(screen.getByRole('button', { name: 'Review & send' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Email subject'), { target: { value: 'My updated guide' } });
    expect(screen.getByLabelText('Email subject')).toHaveValue('My updated guide');
    await act(async () => { finishUpload(ready); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review & send' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Review & send' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & choose recipients' }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/messaging/email/compose', expect.objectContaining({ state: expect.objectContaining({ prefillTemplateId: 84 }) })));
  });

  it('releases the send guard when a dismissed picker upload fails', async () => {
    let rejectUpload!: (error: Error) => void;
    api.upload.mockReturnValue(new Promise<EmailMediaAsset>((_resolve, reject) => { rejectUpload = reject; }));
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'Media' }));
    await userEvent.upload(screen.getByLabelText('Upload email image'), file());
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Images & video' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Images & video' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Review & send' })).toBeDisabled();
    await act(async () => { rejectUpload(new Error('Connection lost')); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review & send' })).toBeEnabled());
    expect(api.error).toHaveBeenCalled(); expect(api.test).not.toHaveBeenCalled();
  });
});
