import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useShootSearch } from './useShootSearch';
import type { ShootData } from '@/types/shoots';

const { searchShoots } = vi.hoisted(() => ({
  searchShoots: vi.fn(),
}));

vi.mock('@/services/shootSearch', async () => {
  const actual = await vi.importActual<typeof import('@/services/shootSearch')>('@/services/shootSearch');
  return {
    ...actual,
    searchShoots,
    SHOOT_SEARCH_DEBOUNCE_MS: 30,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const shoot = (id: string): ShootData =>
  ({
    id,
    status: 'scheduled',
    location: { address: `Addr ${id}` },
  }) as ShootData;

describe('useShootSearch', () => {
  beforeEach(() => {
    searchShoots.mockReset();
  });

  it('does not request the API for empty or whitespace queries', async () => {
    const { result, rerender } = renderHook(
      ({ query }) => useShootSearch({ query, debounceMs: 20 }),
      { initialProps: { query: '' } },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(searchShoots).not.toHaveBeenCalled();
    expect(result.current.shoots).toEqual([]);

    rerender({ query: '   ' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(searchShoots).not.toHaveBeenCalled();
  });

  it('returns hits from the shared client after debounce', async () => {
    searchShoots.mockResolvedValueOnce({ data: [shoot('42')], count: 1 });
    const { result } = renderHook(() =>
      useShootSearch({ query: '42', debounceMs: 20 }),
    );

    await waitFor(() => expect(result.current.hasResolved).toBe(true));
    expect(searchShoots).toHaveBeenCalledWith(
      expect.objectContaining({ search: '42' }),
    );
    expect(result.current.shoots.map((s) => String(s.id))).toEqual(['42']);
    expect(result.current.error).toBeNull();
  });

  it('keeps empty 200 responses as truthful misses', async () => {
    searchShoots.mockResolvedValueOnce({ data: [], count: 0 });
    const { result } = renderHook(() =>
      useShootSearch({ query: 'nope', debounceMs: 20 }),
    );

    await waitFor(() => expect(result.current.hasResolved).toBe(true));
    expect(result.current.shoots).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.count).toBe(0);
  });

  it('keeps errors as errors (not empty hits)', async () => {
    searchShoots.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() =>
      useShootSearch({ query: 'main', debounceMs: 20 }),
    );

    await waitFor(() => expect(result.current.hasResolved).toBe(true));
    expect(result.current.shoots).toEqual([]);
    expect(result.current.error?.message).toBe('boom');
  });

  it('ignores stale responses when a newer query wins the race', async () => {
    let resolveSlow: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      resolveSlow = resolve;
    });

    searchShoots
      .mockImplementationOnce(() => slow)
      .mockResolvedValueOnce({ data: [shoot('2')], count: 1 });

    const { result, rerender } = renderHook(
      ({ query }) => useShootSearch({ query, debounceMs: 15 }),
      { initialProps: { query: 'slow' } },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
    expect(searchShoots).toHaveBeenCalledTimes(1);

    rerender({ query: 'fast' });
    await waitFor(() => expect(searchShoots).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.shoots.map((s) => String(s.id))).toEqual(['2']));

    // Late slow response must not overwrite the newer "fast" result.
    await act(async () => {
      resolveSlow({ data: [shoot('1')], count: 1 });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.shoots.map((s) => String(s.id))).toEqual(['2']);
    expect(result.current.error).toBeNull();
  });

  it('does not call the API when enabled is false', async () => {
    const { result } = renderHook(() =>
      useShootSearch({ query: '42', enabled: false, debounceMs: 20 }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(searchShoots).not.toHaveBeenCalled();
    expect(result.current.shoots).toEqual([]);
  });
});
