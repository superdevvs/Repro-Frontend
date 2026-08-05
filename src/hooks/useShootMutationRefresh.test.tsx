/**
 * Unit tests for useShootMutationRefresh (tasks 6.1/6.2).
 *
 * Verifies the canonical shoot-mutation refresh:
 *  - invalidates the `['shoot', id]` and `['shootFiles', id, ...]` caches, and
 *    that the match holds for both string and number id forms;
 *  - leaves other shoots and unrelated query scopes untouched;
 *  - fans the refresh out to the realtime bus (list, detail, history, overview);
 *  - is a no-op when given no id.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useShootMutationRefresh } from './useShootMutationRefresh';

const triggerShootListRefresh = vi.fn();
const triggerShootDetailRefresh = vi.fn();
const triggerShootHistoryRefresh = vi.fn();
const triggerDashboardOverviewRefresh = vi.fn();

vi.mock('@/realtime/realtimeRefreshBus', () => ({
  triggerShootListRefresh: (...args: unknown[]) => triggerShootListRefresh(...args),
  triggerShootDetailRefresh: (...args: unknown[]) => triggerShootDetailRefresh(...args),
  triggerShootHistoryRefresh: (...args: unknown[]) => triggerShootHistoryRefresh(...args),
  triggerDashboardOverviewRefresh: (...args: unknown[]) => triggerDashboardOverviewRefresh(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const wrapWithClient = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useShootMutationRefresh', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('invalidates the shoot and shootFiles caches for the id and fans out to the refresh bus', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useShootMutationRefresh(), {
      wrapper: wrapWithClient(queryClient),
    });

    act(() => {
      result.current(42);
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    const predicate = invalidateSpy.mock.calls[0][0]?.predicate;
    expect(predicate).toBeTypeOf('function');

    const matches = (queryKey: readonly unknown[]) => predicate?.(
      queryClient.getQueryCache().build(queryClient, { queryKey }),
    ) ?? false;

    // Matches both the number and string id forms used across the codebase.
    expect(matches(['shoot', 42])).toBe(true);
    expect(matches(['shoot', '42'])).toBe(true);
    expect(matches(['shootFiles', 42, 'raw'])).toBe(true);
    expect(matches(['shootFiles', '42', 'edited', null, null, null])).toBe(true);

    // Ignores other shoots and unrelated query scopes.
    expect(matches(['shoot', 99])).toBe(false);
    expect(matches(['shoots'])).toBe(false);
    expect(matches(['invoices', 42])).toBe(false);

    expect(triggerShootListRefresh).toHaveBeenCalledTimes(1);
    expect(triggerShootDetailRefresh).toHaveBeenCalledWith(42);
    expect(triggerShootHistoryRefresh).toHaveBeenCalledTimes(1);
    expect(triggerDashboardOverviewRefresh).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the id is missing', () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useShootMutationRefresh(), {
      wrapper: wrapWithClient(queryClient),
    });

    act(() => {
      result.current(null);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(triggerShootListRefresh).not.toHaveBeenCalled();
    expect(triggerShootDetailRefresh).not.toHaveBeenCalled();
  });
});
