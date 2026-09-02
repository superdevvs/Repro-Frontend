import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useClientDeliveryNotifications } from './useClientDeliveryNotifications';

const testState = vi.hoisted(() => ({
  auth: {
    role: 'client',
    session: { accessToken: 'session-token' },
    user: { id: 42 },
  },
  realtimeOptions: null as null | {
    onActivity?: (activity: { activityType?: string }) => void;
  },
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => testState.auth,
}));

vi.mock('@/hooks/use-shoot-realtime', () => ({
  useShootRealtime: (options: typeof testState.realtimeOptions) => {
    testState.realtimeOptions = options;
  },
}));

const jsonResponse = (payload: unknown) => ({
  ok: true,
  json: async () => payload,
}) as Response;

describe('useClientDeliveryNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    testState.realtimeOptions = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hydrates the server-owned unseen count and marks one event seen', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ data: { id: 91, seen_at: '2026-08-20T09:00:00Z' } });
      }

      return jsonResponse({
        data: {
          unseen_count: 2,
          entries: [
            {
              id: 91,
              shoot_id: 501,
              address: '501 Cross Device Lane',
              delivered_at: '2026-08-20T08:00:00Z',
              seen_at: null,
            },
            {
              id: 90,
              shoot_id: 500,
              address: '500 Sync Street',
              delivered_at: '2026-08-20T07:00:00Z',
              seen_at: null,
            },
          ],
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useClientDeliveryNotifications());

    await waitFor(() => expect(result.current.unseenCount).toBe(2));
    expect(result.current.latestUnseen).toMatchObject({
      id: 91,
      shootId: 501,
      address: '501 Cross Device Lane',
    });

    await act(async () => {
      await expect(result.current.markSeen(91)).resolves.toBe(true);
    });

    expect(result.current.unseenCount).toBe(1);
    expect(result.current.entries.find((entry) => entry.id === 91)?.seenAt).not.toBeNull();
    expect(result.current.latestUnseen).toMatchObject({
      id: 90,
      shootId: 500,
      address: '500 Sync Street',
    });

    await act(async () => {
      await expect(result.current.markSeen(90)).resolves.toBe(true);
    });

    expect(result.current.unseenCount).toBe(0);
    expect(result.current.latestUnseen).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/client/delivery-notifications/90/seen'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('refreshes from the server after a realtime delivery event', async () => {
    let responseData = {
      unseen_count: 0,
      entries: [] as Array<Record<string, unknown>>,
    };
    const fetchMock = vi.fn(async () => jsonResponse({ data: responseData }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useClientDeliveryNotifications());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    responseData = {
      unseen_count: 1,
      entries: [{
        id: 92,
        shoot_id: 502,
        address: '502 Realtime Road',
        delivered_at: '2026-08-20T10:00:00Z',
        seen_at: null,
      }],
    };

    act(() => {
      testState.realtimeOptions?.onActivity?.({
        activityType: 'shoot_finalized_delivered',
      });
    });

    await waitFor(() => expect(result.current.unseenCount).toBe(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.latestUnseen?.shootId).toBe(502);
  });
});
