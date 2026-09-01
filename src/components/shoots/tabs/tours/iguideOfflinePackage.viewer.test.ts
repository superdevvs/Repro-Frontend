import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openIguideOfflineViewer,
  requestIguideOfflineViewerLink,
} from './iguideOfflinePackage';

describe('iGUIDE offline viewer links', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('accepts the nested viewer-link response contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        url: '/iguide/offline-view/token/index.html',
        expires_at: '2026-09-01T02:00:00Z',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestIguideOfflineViewerLink(82);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/integrations/shoots/82/iguide/offline-package/view-link'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.url).toContain('/iguide/offline-view/token/index.html');
    expect(result.expiresAt).toBe('2026-09-01T02:00:00Z');
  });

  it('opens a tab synchronously and navigates it after the signed URL arrives', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: 'https://api.example.test/iguide/offline-view/token/index.html',
      expiresAt: '2026-09-01T02:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const replace = vi.fn();
    const close = vi.fn();
    const viewerWindow = {
      closed: false,
      close,
      location: { replace },
      opener: window,
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(viewerWindow);

    await openIguideOfflineViewer(82);

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(replace).toHaveBeenCalledWith('https://api.example.test/iguide/offline-view/token/index.html');
    expect(close).not.toHaveBeenCalled();
  });

  it('closes the placeholder tab when issuing a viewer link fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Package is still scanning.',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
    const close = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      closed: false,
      close,
      location: { replace: vi.fn() },
      opener: window,
    } as unknown as Window);

    await expect(openIguideOfflineViewer(82)).rejects.toThrow('Package is still scanning.');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
