import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShootDetailsMediaTabDialogs } from './ShootDetailsMediaTabDialogs';

vi.mock('../ShootRequestManager', () => ({ ShootRequestManager: () => null }));
vi.mock('framer-motion', async (importOriginal) => ({
  ...await importOriginal<typeof import('framer-motion')>(), useReducedMotion: () => true,
}));
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('media dialogs shared download state', () => {
  it('keeps a grid-started file download busy in the actual viewer until the shared transfer ends', async () => {
    const onDownloadSingle = vi.fn().mockResolvedValue(undefined);
    const props = {
      viewerOpen: true, setViewerOpen: vi.fn(), viewerIndex: 0, setViewerIndex: vi.fn(), setViewerFiles: vi.fn(),
      viewerFiles: [{ id: 'a', filename: 'a.jpg', thumb: '/photo.jpg', web_path: '/photo.jpg' }],
      getImageUrl: () => '/photo.jpg', shoot: { id: 42, location: { address: '12 Oak Street' } },
      canDownloadSingleMedia: true, canInteractSingleMedia: true, onDownloadSingle,
      selectedFiles: new Set<string>(), showAiEditDialog: false, requestManagerOpen: false,
    };
    const { rerender } = render(<ShootDetailsMediaTabDialogs {...props} downloadingFileIds={new Set(['a'])} />);
    const button = await screen.findByRole('button', { name: 'Downloading…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    fireEvent.click(button);
    expect(onDownloadSingle).not.toHaveBeenCalled();
    rerender(<ShootDetailsMediaTabDialogs {...props} downloadingFileIds={new Set()} />);
    const ready = screen.getByRole('button', { name: 'Download' });
    expect(ready.getAttribute('aria-busy')).toBe('false');
    expect((ready as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(ready); });
    expect(onDownloadSingle).toHaveBeenCalledWith('a');
  });
});
