import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePhotographerRoster } from './usePhotographerRoster';
afterEach(() => { cleanup(); vi.useRealTimers(); });
const people = [{ id: '1136', name: 'Delmar' }];
describe('independent photographer roster', () => {
  it('offers retry after a directory failure without requiring an edit form reset', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(people);
    const { result } = renderHook(() => usePhotographerRoster(true, '5866', load));
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.photographers).toEqual(people));
    expect(result.current.status).toBe('ready');
  });
  it('ignores late results after the editing scope changes', async () => {
    let resolveOld!: (value: typeof people) => void;
    const load = vi.fn().mockReturnValueOnce(new Promise<typeof people>(done => { resolveOld = done; })).mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(({ scope }) => usePhotographerRoster(true, scope, load), { initialProps: { scope: '5866' } });
    rerender({ scope: '5867' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => resolveOld(people));
    expect(result.current.photographers).toEqual([]);
  });
  it('bounds a hanging directory request and ignores its late response', async () => {
    vi.useFakeTimers();
    let resolve!: (value: typeof people) => void;
    const load = vi.fn().mockReturnValue(new Promise<typeof people>(done => { resolve = done; }));
    const { result } = renderHook(() => usePhotographerRoster(true, '5866', load));
    await act(async () => { vi.advanceTimersByTime(25000); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/timed out/);
    await act(async () => resolve(people));
    expect(result.current.photographers).toEqual([]);
  });
});
