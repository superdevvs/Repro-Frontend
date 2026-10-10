import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ShootActivityEvent } from './use-shoot-realtime';

const realtime = vi.hoisted(() => ({ onActivity: undefined as ((event: ShootActivityEvent) => void) | undefined }));

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
  useShootRealtime: (options: { onActivity?: (event: ShootActivityEvent) => void }) => { realtime.onActivity = options.onActivity; },
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
  let serverState: { lastSeenAt: number | null; readIds: Record<string, number> };
  let failSync: boolean;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    activityLog = buildOldFeed(50);
    serverState = { lastSeenAt: null, readIds: {} };
    failSync = false;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/notifications/read-state')) {
          if (failSync) return { ok: false, status: 503, json: async () => ({}) };
          const { ids, lastSeenAt } = JSON.parse(String(options?.body));
          ids.forEach((id: string) => { serverState.readIds[id] = Date.now(); });
          if (typeof lastSeenAt === 'number') serverState.lastSeenAt = Math.max(serverState.lastSeenAt ?? 0, lastSeenAt);
          return { ok: true, json: async () => ({ data: serverState }) };
        }
        if (!url.includes('/api/notifications')) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        return {
          ok: true,
          json: async () => ({ data: { activity_log: activityLog, read_state: { ...serverState, readIds: { ...serverState.readIds } } } }),
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

  it('uses persisted read state on another device and refreshes reads even when feed IDs do not change', async () => {
    serverState.lastSeenAt = Date.now() - 3_600_000;
    activityLog = [{ ...activityLog[0], id: 'sa-101', timestamp: new Date().toISOString(), shootId: 1 }, { ...activityLog[1], id: 'sa-102', timestamp: new Date().toISOString(), shootId: 1 }];
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(2));
    expect(result.current.unreadCount).toBe(1);
    serverState.readIds = { 'sa-101': Date.now(), 'sa-102': Date.now() };
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('keeps a new realtime event unread after acknowledging a displayed shoot snapshot', async () => {
    serverState.lastSeenAt = Date.now() - 3_600_000;
    activityLog = [{ ...activityLog[0], id: 'sa-101', timestamp: new Date().toISOString(), shootId: 1 }];
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    act(() => result.current.markManyAsRead(['sa-101']));
    act(() => realtime.onActivity?.({ id: 'sa-102', shootId: 1, activityType: 'media_uploaded', message: 'New upload', timestamp: new Date(Date.now() + 1000).toISOString(), userId: 2 }));
    await waitFor(() => expect(result.current.notifications.find(item => item.id === 'sa-102')?.isRead).toBe(false));
    expect(result.current.unreadCount).toBe(1);
    expect(serverState.readIds['sa-102']).toBeUndefined();
  });

  it('quietly retains your own activity and deduplicates live events on polling', async () => {
    serverState.lastSeenAt = Date.now() - 3_600_000;
    activityLog = [];
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => realtime.onActivity?.({ id: 'sa-55', shootId: 1, activityType: 'shoot_editing_started', message: 'Editing', timestamp: new Date().toISOString(), userId: 1, address: 'Home' }));
    expect(result.current.unreadCount).toBe(0);
    activityLog = [{ id: 'sa-55', shootId: 1, action: 'shoot_editing_started', type: 'shoot', message: 'Editing', timestamp: new Date().toISOString(), isOwnAction: true } as typeof activityLog[number]];
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
  });

  it('keeps local receipts if sync fails and retries without losing an acknowledgement', async () => {
    serverState.lastSeenAt = Date.now() - 3_600_000;
    activityLog = [{ ...activityLog[0], id: 'sa-1', timestamp: new Date().toISOString() }];
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    failSync = true;
    act(() => result.current.markAsRead('sa-1'));
    await waitFor(() => expect(result.current.readSyncError).toMatch(/Sync is pending/));
    expect(result.current.unreadCount).toBe(0);
    failSync = false;
    await act(async () => { await result.current.retryReadSync(); });
    expect(result.current.readSyncError).toBeNull();
    expect(serverState.readIds['sa-1']).toBeDefined();
  });
  it('keeps failures visible even when triggered by your own action', async () => {
    serverState.lastSeenAt = Date.now() - 3_600_000;
    activityLog = [];
    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => realtime.onActivity?.({ id: 'sa-56', shootId: 1, activityType: 'upload_failed', message: 'Upload failed', timestamp: new Date().toISOString(), userId: 1 }));
    expect(result.current.unreadCount).toBe(1);
    activityLog = [{ id: 'sa-56', shootId: 1, action: 'upload_failed', type: 'shoot', message: 'Upload failed', timestamp: new Date().toISOString(), isOwnAction: true } as typeof activityLog[number]];
    await act(async () => { await result.current.refresh(); });
    expect(result.current.notifications.find(item => item.id === 'sa-56')?.isRead).toBe(false);
  });
});
