import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useShootDetailsScreen } from './useShootDetailsScreen';

const { refetch } = vi.hoisted(() => ({ refetch: vi.fn() }));
const cached = { id: '6022', editVersion: 'cached' };
vi.mock('@/hooks/useShoot', () => ({ useShoot: () => ({ data: cached, refetch }) }));
vi.mock('./useShootDetailsController', () => ({ useShootDetailsController: () => ({ roleFlags: {} }) }));
vi.mock('./useShootRawFileCount', () => ({ useShootRawFileCount: () => 0 }));
vi.mock('@/realtime/realtimeRefreshBus', () => ({ registerShootDetailRefresh: () => () => {} }));

afterEach(() => { cleanup(); refetch.mockReset(); });

it('excludes cached data from a failed conflict review while keeping normal refresh behavior', async () => {
  refetch.mockResolvedValue({ isSuccess: false, data: cached });
  const { result } = renderHook(() => useShootDetailsScreen({ shootId: cached.id }));
  await act(async () => {
    expect(await result.current.refreshShoot({ requireFresh: true })).toBeNull();
    expect(await result.current.refreshShoot()).toBe(cached);
  });
  expect(refetch).toHaveBeenCalledWith({ throwOnError: true, cancelRefetch: false });
});

it('returns the newly fetched version for review', async () => {
  const latest = { ...cached, editVersion: 'latest' };
  refetch.mockResolvedValue({ isSuccess: true, data: latest });
  const { result } = renderHook(() => useShootDetailsScreen({ shootId: cached.id }));
  await act(async () => expect(await result.current.refreshShoot({ requireFresh: true })).toBe(latest));
});
