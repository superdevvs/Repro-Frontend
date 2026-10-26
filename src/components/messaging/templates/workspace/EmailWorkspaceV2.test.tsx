import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@/types/messaging';
import type { EmailMediaAsset } from '@/types/emailTemplateWorkspace';
import { EmailTemplateWorkspace } from './EmailTemplateWorkspace';
import { newSection, startingEmail } from './emailWorkspaceModel';
import { emailPreset, emailSectionPattern } from './emailWorkspacePresets';
import { flattenEmailSections, freshEmailSection } from './emailWorkspaceTree';

const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), preview: vi.fn(), suggest: vi.fn(), upload: vi.fn(), asset: vi.fn(), video: vi.fn(), autosave: vi.fn(), recovery: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { error: mocks.error, success: mocks.success, info: vi.fn() } }));
vi.mock('@/services/messaging', () => ({ updateTemplate: mocks.update, createTemplate: mocks.create, previewTemplate: mocks.preview, getTemplates: async () => [], testSendTemplate: vi.fn() }));
vi.mock('@/services/emailTemplateWorkspace', () => ({ suggestEmailTemplate: mocks.suggest, generateEmailArtwork: vi.fn(), getEmailArtwork: vi.fn() }));
vi.mock('@/services/emailWorkspaceV2', () => ({
  emailWorkspaceCapabilities: async () => ({ enabled: true, version: 2 }), listEmailAssets: async () => ({ data: [], last_page: 1 }),
  uploadEmailAsset: mocks.upload, getEmailAsset: mocks.asset, resolveEmailVideo: mocks.video, loadEmailServerDraft: mocks.recovery,
  saveEmailServerDraft: mocks.autosave, deleteEmailServerDraft: async () => ({}), getEmailRevisions: async () => [], listEmailSavedSections: async () => [], saveEmailSection: async () => ({}),
}));

const template = { ...startingEmail('tips'), id: 84, workspace_revision: 0, is_active: true, is_system: false, created_at: '', updated_at: '' } as MessageTemplate;
const image = { ...newSection('feature'), id: 'media-feature', heading: 'Your listing photography', body: 'Original benefit', image_url: 'https://example.com/old.png', alt: 'Property' };
const asset: EmailMediaAsset = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'My property', source: 'uploaded', status: 'processing', url: null, mime: null, original_bytes: 2000000, bytes: 0, width: 0, height: 0, error: null };
function setup(value: MessageTemplate | null = template) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><EmailTemplateWorkspace template={value} open onSuccess={vi.fn()} onClose={vi.fn()}/></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  mocks.recovery.mockResolvedValue(null); mocks.autosave.mockImplementation(async (_id, revision) => ({ revision: revision + 1 }));
  mocks.update.mockImplementation(async (id, data) => ({ ...template, ...data, id, workspace_revision: 1 }));
  mocks.create.mockImplementation(async data => ({ ...template, ...data, id: 90 }));
  mocks.preview.mockResolvedValue({ html: '<p>Rendered content</p>' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('rich email authoring', () => {
  it('offers differentiated email starters and creates editable package cards', async () => {
    setup(null);
    fireEvent.click(await screen.findByRole('button', { name: /Offer & packages/ }));
    expect(screen.getByRole('button', { name: 'Edit Your offer' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add section/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Package \/ pricing cards/ }));
    expect(screen.getAllByRole('button', { name: 'Edit Package name' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Reorder columns' })).toHaveLength(2);
  });

  it('uploads a replacement, keeps editing during optimization and applies the ready image without losing copy', async () => {
    let finish!: (value: EmailMediaAsset) => void;
    mocks.upload.mockResolvedValue(asset); mocks.asset.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    setup({ ...template, editor_document_json: { version: 2, format: 'sections', preheader: '', sections: [image] } });
    await screen.findByRole('button', { name: 'Media' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Your listing photography' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload / choose image or thumbnail' }));
    await userEvent.upload(screen.getByLabelText('Upload email image'), new File(['fake-image'], 'property.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(mocks.asset).toHaveBeenCalledWith(asset.id, 84));
    expect(screen.getByRole('status', { name: 'Optimizing image: My property' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'My edited benefit while the image loads.' } });
    await act(async () => { finish({ ...asset, status: 'ready', url: 'https://example.com/optimized.jpg', mime: 'image/jpeg', bytes: 120000, width: 320, height: 220 }); });
    expect(await screen.findByRole('img', { name: 'My property' })).toHaveAttribute('src', 'https://example.com/optimized.jpg');
    expect(screen.getByLabelText('Message')).toHaveValue('My edited benefit while the image loads.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(84, expect.objectContaining({ workspace_revision: 0, editor_document_json: expect.objectContaining({ sections: [expect.objectContaining({ media_id: asset.id, body: 'My edited benefit while the image loads.', image_url: 'https://example.com/optimized.jpg' })] }) })));
  });

  it('adds a hosted video and custom-thumbnail fallback as a normal saved block', async () => {
    mocks.video.mockResolvedValue({ url: 'https://www.loom.com/share/guide', title: 'Watch video', provider: 'loom', asset: null, needs_thumbnail: true });
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'Media' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Video' }));
    fireEvent.change(screen.getByLabelText('Video URL'), { target: { value: 'https://www.loom.com/share/guide' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add video with thumbnail' }));
    await screen.findByRole('button', { name: 'Edit Watch video' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(84, expect.objectContaining({ editor_document_json: expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ type: 'video', video_url: 'https://www.loom.com/share/guide' })]) }) })));
  });

  it('restores a server draft without saving or activating a template', async () => {
    const draft = { ...startingEmail('tips'), subject: 'Recovered on another device' };
    mocks.recovery.mockResolvedValue({ id: asset.id, revision: 3, draft });
    setup(); fireEvent.click(await screen.findByRole('button', { name: 'Restore server draft' }));
    expect(screen.getByLabelText('Email subject')).toHaveValue('Recovered on another device');
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });

  it('keeps a manual edit on a child card when generating a section-scoped proposal', async () => {
    const row = emailSectionPattern('benefits'); const child = row.columns![0][0];
    mocks.suggest.mockResolvedValue({ editor_document_json: { version: 2, format: 'sections', preheader: '', sections: [{ ...row, columns: row.columns!.map((column, index) => index ? column : [{ ...child, body: 'Revised benefit' }]) }] } });
    setup({ ...template, editor_document_json: { version: 2, format: 'sections', preheader: '', sections: [row] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Media' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Images & video' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Benefit 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie about this section/ }));
    fireEvent.change(screen.getByLabelText('Ask Robbie'), { target: { value: 'Improve this benefit' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask Robbie ↑/ }));
    await waitFor(() => expect(mocks.suggest).toHaveBeenCalledWith(expect.objectContaining({ scope: 'section', section_id: child.id })));
  });
});

describe('layout document helpers', () => {
  it('creates every starter as bounded version 2 content and regenerates child IDs when copied', () => {
    for (const purpose of ['sales','offer','portfolio','newsletter','announcement','onboarding','guide','followup','letter']) {
      const draft = emailPreset(purpose);
      expect(draft.editor_document_json.version).toBe(2);
      expect(draft.editor_document_json.sections.length).toBeGreaterThan(2);
    }
    const row = emailSectionPattern('packages'); const copy = freshEmailSection(row);
    const originalIds = new Set(flattenEmailSections([row]).map(item => item.id));
    expect(flattenEmailSections([copy]).every(item => !originalIds.has(item.id))).toBe(true);
  });
});
