import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { useMediaViewerController } from './useMediaViewerController';

vi.mock('framer-motion', () => ({ useReducedMotion: () => true }));
const files = [{ id: 'a', filename: 'a.jpg' }, { id: 'b', filename: 'b.jpg' }] as MediaFile[];
const base = {
  isOpen: true, files, onClose: vi.fn(), onIndexChange: vi.fn(), getImageUrl: () => '/photo.jpg',
};
afterEach(cleanup);

describe('viewer download lifetime', () => {
  it('retains each in-progress file while navigating and prevents same-tick duplicate requests', async () => {
    let finishA!: () => void;
    let finishB!: () => void;
    const a = new Promise<void>((resolve) => { finishA = resolve; });
    const b = new Promise<void>((resolve) => { finishB = resolve; });
    const onDownloadSingle = vi.fn((id: string) => id === 'a' ? a : b);
    const { result, rerender } = renderHook(({ currentIndex }) => useMediaViewerController({ ...base, currentIndex, onDownloadSingle }), { initialProps: { currentIndex: 0 } });
    let pendingA!: Promise<void>;
    let pendingB!: Promise<void>;
    act(() => {
      pendingA = result.current!.handleDownloadSingle('a');
      void result.current!.handleDownloadSingle('a');
    });
    expect(onDownloadSingle).toHaveBeenCalledTimes(1);
    expect(result.current!.downloadingFileIds.has('a')).toBe(true);
    rerender({ currentIndex: 1 });
    act(() => { pendingB = result.current!.handleDownloadSingle('b'); });
    expect([...result.current!.downloadingFileIds]).toEqual(['a', 'b']);
    await act(async () => { finishA(); await pendingA; });
    expect([...result.current!.downloadingFileIds]).toEqual(['b']);
    await act(async () => { finishB(); await pendingB; });
    expect(result.current!.downloadingFileIds.size).toBe(0);
  });

  it('reflects a grid-started transfer and clears local busy state after rejection', async () => {
    const onDownloadSingle = vi.fn().mockRejectedValue(new Error('Transfer failed'));
    const { result, rerender } = renderHook(({ downloadingFileIds }) => useMediaViewerController({ ...base, currentIndex: 0, onDownloadSingle, downloadingFileIds }), { initialProps: { downloadingFileIds: new Set(['a']) } });
    expect(result.current!.downloadingFileIds.has('a')).toBe(true);
    await act(async () => { await result.current!.handleDownloadSingle('a'); });
    expect(onDownloadSingle).not.toHaveBeenCalled();
    rerender({ downloadingFileIds: new Set() });
    await act(async () => { await expect(result.current!.handleDownloadSingle('a')).rejects.toThrow('Transfer failed'); });
    expect(onDownloadSingle).toHaveBeenCalledTimes(1);
    expect(result.current!.downloadingFileIds.size).toBe(0);
  });
});
