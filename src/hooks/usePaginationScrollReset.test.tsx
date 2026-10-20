import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaginationScrollReset } from './usePaginationScrollReset';
import { scrollPaginatedListToTop } from '@/utils/paginationScroll';

vi.mock('@/utils/paginationScroll', () => ({ scrollPaginatedListToTop: vi.fn() }));

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const list = document.createElement('div');
const targetRef = { current: list };

function paint() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(0));
  });
}

beforeEach(() => {
  frames = new Map(); nextFrame = 0;
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('pagination scroll reset', () => {
  it('preserves the initial reading position and background refreshes', () => {
    const { rerender } = renderHook(({ loading }) => usePaginationScrollReset(1, { isLoading: loading, targetRef }), { initialProps: { loading: false } });
    paint();
    rerender({ loading: true }); paint();
    rerender({ loading: false }); paint();
    expect(scrollPaginatedListToTop).not.toHaveBeenCalled();
  });

  it.each([2, 3, 1])('resets when navigating to page %s after its rows render', page => {
    const { rerender } = renderHook(({ page }) => usePaginationScrollReset(page, { targetRef }), { initialProps: { page: 4 } });
    rerender({ page });
    expect(scrollPaginatedListToTop).not.toHaveBeenCalled();
    paint();
    expect(scrollPaginatedListToTop).toHaveBeenCalledExactlyOnceWith(list);
    rerender({ page }); paint();
    expect(scrollPaginatedListToTop).toHaveBeenCalledTimes(1);
  });

  it('waits for delayed server results before resetting', () => {
    const { rerender } = renderHook(({ page, loading }) => usePaginationScrollReset(page, { isLoading: loading, targetRef }), { initialProps: { page: 1, loading: false } });
    rerender({ page: 2, loading: true }); paint();
    expect(scrollPaginatedListToTop).not.toHaveBeenCalled();
    rerender({ page: 2, loading: false }); paint();
    expect(scrollPaginatedListToTop).toHaveBeenCalledExactlyOnceWith(list);
  });

  it('returns to the list when page size changes on the first page', () => {
    const { rerender } = renderHook(({ size }) => usePaginationScrollReset(1, { pageSize: size, targetRef }), { initialProps: { size: 16 } });
    rerender({ size: 48 }); paint();
    expect(scrollPaginatedListToTop).toHaveBeenCalledExactlyOnceWith(list);
  });

  it('cancels stale resets during rapid navigation and unmounting', () => {
    const { rerender, unmount } = renderHook(({ page, loading }) => usePaginationScrollReset(page, { isLoading: loading, targetRef }), { initialProps: { page: 1, loading: false } });
    rerender({ page: 2, loading: false });
    rerender({ page: 3, loading: true }); paint();
    expect(scrollPaginatedListToTop).not.toHaveBeenCalled();
    rerender({ page: 3, loading: false });
    unmount(); paint();
    expect(scrollPaginatedListToTop).not.toHaveBeenCalled();
  });
});
