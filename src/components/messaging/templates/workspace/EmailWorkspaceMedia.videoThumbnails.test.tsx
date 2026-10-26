import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailDashboardMedia, EmailMediaAsset, EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import { EmailWorkspaceMedia } from './EmailWorkspaceMedia';
import { newSection } from './emailWorkspaceModel';

const api = vi.hoisted(() => ({ list: vi.fn(), dashboard: vi.fn(), upload: vi.fn(), variant: vi.fn(), import: vi.fn(), resolve: vi.fn(), error: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('@/lib/sonner-toast', () => ({ toast: { error: api.error, info: vi.fn() } }));
vi.mock('@/services/emailWorkspaceV2', () => ({
  listEmailAssets: api.list, listDashboardEmailMedia: api.dashboard, uploadEmailAsset: api.upload,
  variantEmailAsset: api.variant, importDashboardEmailMedia: api.import, resolveEmailVideo: api.resolve,
  archiveEmailAsset: vi.fn(),
}));

const source: EmailMediaAsset = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Saved photograph', source: 'uploaded', status: 'ready', legacy: false, url: 'https://example.com/source.jpg', mime: 'image/jpeg', original_bytes: 200000, bytes: 100000, width: 1200, height: 800, error: null };
const rendition: EmailMediaAsset = { ...source, id: '550e8400-e29b-41d4-a716-446655440001', url: null, status: 'processing' };
const video = { ...newSection('video'), video_url: 'https://example.com/film.mp4', media_id: source.id };
const dashboardItem: EmailDashboardMedia = { id: '84:0:1', shoot_id: 84, name: 'Released property photograph', url: 'https://example.com/property.jpg', video_url: 'https://example.com/film.mp4', watch_url: 'https://reprodashboard.com/property/84' };

function setup(target?: EmailTemplateSection) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onUse = vi.fn(), onVideo = vi.fn();
  const view = (next?: EmailTemplateSection) => <QueryClientProvider client={client}><EmailWorkspaceMedia target={next} templateId={42} onUse={onUse} onVideo={onVideo} onGenerate={vi.fn()}/></QueryClientProvider>;
  const result = render(view(target));
  return { ...result, onUse, onVideo, setTarget: (next?: EmailTemplateSection) => result.rerender(view(next)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({ data: [source], last_page: 1 });
  api.dashboard.mockResolvedValue([dashboardItem]);
  api.upload.mockResolvedValue(rendition); api.variant.mockResolvedValue(rendition); api.import.mockResolvedValue(rendition);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:email-upload');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('manual video thumbnail renditions', () => {
  it('bakes the play button into uploaded video posters and returns the processing asset immediately', async () => {
    const { onUse } = setup(video);
    await userEvent.upload(screen.getByLabelText('Upload email image'), new File(['pixels'], 'poster.png', { type: 'image/png' }));
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ play: true }), expect.any(Function)));
    expect(onUse).toHaveBeenCalledWith(rendition);
    expect(screen.getByRole('checkbox', { name: /Show play button/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show play button/ })).toBeDisabled();
  });

  it.each([false, true])('creates a play rendition when reusing a photograph (legacy=%s)', async legacy => {
    api.list.mockResolvedValue({ data: [{ ...source, legacy }], last_page: 1 });
    const { onUse } = setup(video);
    fireEvent.click(await screen.findByRole('button', { name: /Saved photograph/ }));
    await waitFor(() => expect(api.variant).toHaveBeenCalledWith(source.id, expect.objectContaining({ play: true }), 42));
    expect(onUse).toHaveBeenCalledWith(rendition);
  });

  it('derives play from the current target when the panel switches from an image to a video', async () => {
    const { setTarget } = setup(newSection('image'));
    await screen.findByRole('button', { name: /Saved photograph/ });
    setTarget(video);
    fireEvent.click(screen.getByRole('button', { name: /Saved photograph/ }));
    await waitFor(() => expect(api.variant).toHaveBeenCalledWith(source.id, expect.objectContaining({ play: true }), 42));
  });

  it('keeps the baked play button when cropping an existing video poster', async () => {
    setup(video);
    fireEvent.change(screen.getByLabelText('Image crop'), { target: { value: '16:9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create new crop / rendition' }));
    await waitFor(() => expect(api.variant).toHaveBeenCalledWith(source.id, expect.objectContaining({ play: true, crop: '16:9' }), 42));
  });

  it('processes a brand asset through upload before using it as a video thumbnail', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['brand pixels'], { type: 'image/png' }) });
    vi.stubGlobal('fetch', fetch);
    const { onUse } = setup(video);
    fireEvent.click(screen.getByRole('tab', { name: 'Brand assets' }));
    fireEvent.click(screen.getByRole('button', { name: /welcome/ }));
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ play: true })));
    expect(fetch).toHaveBeenCalledWith('/images/email-atelier/v6/welcome.png');
    expect(api.upload.mock.calls[0][0].name).toBe('welcome.png');
    expect(onUse).toHaveBeenCalledWith(rendition);
  });

  it('bakes play into a released dashboard image selected for a video section', async () => {
    setup(video);
    fireEvent.click(screen.getByRole('tab', { name: 'Dashboard media' }));
    fireEvent.click(await screen.findByRole('button', { name: /Released property photograph/ }));
    await waitFor(() => expect(api.import).toHaveBeenCalledWith(dashboardItem, expect.objectContaining({ play: true })));
  });

  it('uses a play rendition for dashboard video selection without a preselected video section', async () => {
    const { onVideo } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Dashboard media' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use video' }));
    await waitFor(() => expect(api.import).toHaveBeenCalledWith(dashboardItem, expect.objectContaining({ play: true })));
    expect(onVideo).toHaveBeenCalledWith(dashboardItem.watch_url, dashboardItem.name, rendition);
  });

  it('defaults the thumbnail library to a baked play rendition while regular image reuse stays direct', async () => {
    const { onUse } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /Saved photograph/ }));
    expect(onUse).toHaveBeenCalledWith(source); expect(api.variant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Video thumbnails' }));
    expect(screen.getByRole('checkbox', { name: /Show play button/ })).toBeChecked();
    fireEvent.click(await screen.findByRole('button', { name: /Saved photograph/ }));
    await waitFor(() => expect(api.variant).toHaveBeenCalledWith(source.id, expect.objectContaining({ play: true }), 42));
  });
});
