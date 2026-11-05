import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { mediaSortStorageKey, sortMediaFiles } from './mediaSort';
import { useMediaOrderState } from './useMediaOrderState';

const file = (id: string, sort_order = 0): MediaFile => ({ id, filename: `${id}.jpg`, sort_order });
const saved = [file('20', 2), file('30', 3), file('10', 1)];
const pending = () => ({ current: false });
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('saved shoot image order', () => {
  it.each([null, 'time', 'name', 'date'])('opens a curated shoot in its saved order despite browser preference %s', remembered => {
    if (remembered) localStorage.setItem(mediaSortStorageKey(5933), remembered);
    const { result } = renderHook(() => useMediaOrderState(5933, saved, pending(), true));
    expect(result.current.sortOrder).toBe('manual');
    expect(sortMediaFiles(saved, result.current.sortOrder, result.current.manualOrder).map(f => f.id))
      .toEqual(['10', '20', '30']);
  });

  it('keeps capture-time sorting for new uploads whose positions were assigned automatically', () => {
    const { result } = renderHook(() => useMediaOrderState(5933, saved, pending(), false));
    expect(result.current.sortOrder).toBe('time');
  });

  it('restores an explicitly selected Manual view on an active shoot', () => {
    localStorage.setItem(mediaSortStorageKey(5933), 'manual');
    const { result } = renderHook(() => useMediaOrderState(5933, saved, pending(), false));
    expect(result.current.manualOrder).toEqual(['10', '20', '30']);
  });

  it('restores order as separately loaded media arrives instead of preserving an incomplete first response', () => {
    const ref = pending();
    const { result, rerender } = renderHook(({ files }) => useMediaOrderState(5933, files, ref, true),
      { initialProps: { files: [] as MediaFile[] } });
    rerender({ files: [file('99')] });
    rerender({ files: [file('99'), ...saved] });
    expect(result.current.sortOrder).toBe('manual');
    expect(result.current.manualOrder).toEqual(['10', '20', '30', '99']);
  });

  it('takes updated saved positions on refetch, even when file membership stays identical', () => {
    const ref = pending();
    const { result, rerender } = renderHook(({ files }) => useMediaOrderState(5933, files, ref, true),
      { initialProps: { files: saved } });
    rerender({ files: [file('20', 3), file('30', 1), file('10', 2)] });
    expect(result.current.manualOrder).toEqual(['30', '10', '20']);
  });

  it('does not let a refetch discard an unsaved drag or its retry order', () => {
    const ref = pending();
    const { result, rerender } = renderHook(({ files }) => useMediaOrderState(5933, files, ref, true),
      { initialProps: { files: saved } });
    act(() => { ref.current = true; result.current.setManualOrder(['30', '20', '10']); });
    rerender({ files: [file('20', 3), file('30', 2), file('10', 1)] });
    expect(result.current.manualOrder).toEqual(['30', '20', '10']);
    act(() => { ref.current = false; result.current.acceptSavedOrder(); });
    expect(result.current.manualOrder).toEqual(['10', '30', '20']);
  });

  it('lets a user inspect another sort while open, then reopens in the saved arrangement', () => {
    const ref = pending();
    const view = renderHook(() => useMediaOrderState(5933, saved, ref, true));
    act(() => view.result.current.setSortOrder('name'));
    expect(view.result.current.sortOrder).toBe('name');
    view.unmount();
    const reopened = renderHook(() => useMediaOrderState(5933, saved, ref, true));
    expect(reopened.result.current.sortOrder).toBe('manual');
    expect(reopened.result.current.manualOrder).toEqual(['10', '20', '30']);
  });

  it('uses the saved arrangement for read-only media too', () => {
    const readonlyFiles = saved.map(f => ({ ...f, can_interact: false }));
    const { result } = renderHook(() => useMediaOrderState(5933, readonlyFiles, pending(), true));
    expect(result.current.sortOrder).toBe('manual');
    expect(result.current.manualOrder).toEqual(['10', '20', '30']);
  });
});
