import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { accessToken: 'test-token' },
    user: { id: 1 },
    role: 'superadmin',
    isImpersonating: false,
    originalUser: null,
  }),
}));

vi.mock('./use-sms-realtime', () => ({
  useSmsRealtime: () => undefined,
}));

vi.mock('./use-email-realtime', () => ({
  useEmailRealtime: () => undefined,
}));

vi.mock('./use-shoot-realtime', () => ({
  useShootRealtime: () => undefined,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  API_BASE_URL: '',
}));

import { useNotifications } from './useNotifications';

const weeksAgo = (weeks: number) => new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
const monthsAgo = (months: number) => new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString();

const buildOldFeed = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: index % 3 === 0 ? `email-${index}` : index % 3 === 1 ? `email-issue-${index}` : `sa-${index}`,
    message: `Historical activity ${index}`,
    action: 'shoot_updated',
    type: 'shoot',
    timestamp: index % 2 === 0 ? weeksAgo(3 + (index % 5)) : monthsAgo(2 + (index % 4)),
    shootId: 100 + index,
  }));

describe('useNotifications', () => {
  let queryClient: QueryClient;
  let activityLog: ReturnType<typeof buildOldFeed>;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    activityLog = buildOldFeed(50);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.includes('/api/notifications')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        return {
          ok: true,
          json: async () => ({ data: { activity_log: activityLog } }),
        };
      }),
    );
  });

  afterEach(() => {
    queryClient.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('seeds a last-seen watermark so the historical 50 do not badge, then tracks new activity', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.notifications).toHaveLength(50);
    });

    expect(result.current.unreadCount).toBe(0);

    const newerId = 'sa-new-after-watermark';
    activityLog = [
      ...activityLog,
      {
        id: newerId,
        message: 'Brand new shoot update',
        action: 'shoot_updated',
        type: 'shoot',
        timestamp: new Date(Date.now() + 60_000).toISOString(),
        shootId: 999,
      },
    ];

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === newerId)).toBe(true);
    });

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });
});
