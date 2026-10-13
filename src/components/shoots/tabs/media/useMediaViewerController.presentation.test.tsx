import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { useMediaViewerController } from './useMediaViewerController';

const auth = vi.hoisted(() => ({ role: 'client' }));
const fetchMock = vi.fn();
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ ...auth, user: { id: 10 } }) }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => true }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({}), getImpersonatedUserId: () => null }));
const file: MediaFile = { id: '11', filename: 'final.jpg', media_type: 'edited', workflowStage: 'verified', can_manage_visibility: true, can_set_hero: true };
const base = { isOpen: true, onClose: vi.fn(), currentIndex: 0, onIndexChange: vi.fn(), getImageUrl: () => '/image.jpg', shoot: { id: 156 } as never };
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('lightbox curation uses the same scoped file gates', () => {
  it.each(['client', 'salesRep'])('%s can choose hero; hidden files allow restore but no hero or download', async role => {
    auth.role = role;
    const onToggleHidden = vi.fn(), onDownloadSingle = vi.fn(), onShootUpdate = vi.fn();
    const { result, rerender } = renderHook(({ currentFile }) => useMediaViewerController({ ...base, files: [currentFile], isClient: role === 'client', onToggleHidden, onDownloadSingle, canDownloadSingleMedia: true, onShootUpdate }), { initialProps: { currentFile: file } });
    expect(result.current!.canSetHero).toBe(true);
    expect(result.current!.onToggleHidden).toBe(onToggleHidden);
    await act(async () => { await result.current!.handleSetHeroImage(); });
    expect(fetchMock.mock.calls.some(([url, options]) => String(url).endsWith('/media/11/cover') && options.method === 'POST')).toBe(true);
    expect(onShootUpdate).toHaveBeenCalled();
    rerender({ currentFile: { ...file, is_hidden: true } as MediaFile });
    expect(result.current!.canSetHero).toBe(false);
    expect(result.current!.onToggleHidden).toBe(onToggleHidden);
    expect(result.current!.canDownloadSingleMedia).toBe(false);
    expect(result.current!.onDownloadSingle).toBeUndefined();
    expect(result.current!.onToggleFavorite).toBeUndefined();
    expect(result.current!.onAddComment).toBeUndefined();
    expect(result.current!.canRequestModification).toBe(false);
    await act(async () => { await result.current!.handleDownloadSingle('11'); });
    expect(onDownloadSingle).not.toHaveBeenCalled();
  });
  it.each(['client', 'salesRep'])('read-only %s lightbox has no curation controls even when callback exists', role => {
    auth.role = role;
    const { result } = renderHook(() => useMediaViewerController({ ...base, files: [{ ...file, can_manage_visibility: false, can_set_hero: false }], onToggleHidden: vi.fn() }));
    expect(result.current!.canSetHero).toBe(false);
    expect(result.current!.onToggleHidden).toBeUndefined();
  });
  it('retains comments and modification requests for visible unpaid client previews', () => {
    auth.role = 'client';
    const onAddComment = vi.fn(), onToggleFavorite = vi.fn();
    const { result } = renderHook(() => useMediaViewerController({ ...base, files: [{ ...file, uses_watermark: true, can_download: false, media_curation_scope: 'customer' }],
      isClient: true, canInteractSingleMedia: true, canDownloadSingleMedia: true, onDownloadSingle: vi.fn(), onAddComment, onToggleFavorite }));
    expect(result.current!.canInteractSingleMedia).toBe(true);
    expect(result.current!.onAddComment).toBe(onAddComment);
    expect(result.current!.onToggleFavorite).toBe(onToggleFavorite);
    expect(result.current!.canRequestModification).toBe(true);
    expect(result.current!.canDownloadSingleMedia).toBe(false);
    expect(result.current!.canSetHero).toBe(true);
  });
});
