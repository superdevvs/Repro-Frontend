import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { triggerDashboardOverviewRefresh } from '@/realtime/realtimeRefreshBus';
import { useDashboardOverview } from './useDashboardOverview';

const mocks = vi.hoisted(() => ({
  role: 'photographer',
  fetchOverview: vi.fn(async () => ({ stats: {} })),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: mocks.role, session: { accessToken: 'test-token' } }),
}));
vi.mock('@/services/dashboardService', () => ({
  fetchDashboardOverview: mocks.fetchOverview,
}));

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const refreshThroughRealtime = async () => {
  vi.useFakeTimers();
  try {
    await act(async () => {
      triggerDashboardOverviewRefresh();
      await vi.advanceTimersByTimeAsync(300);
    });
  } finally {
    vi.useRealTimers();
  }
};

beforeEach(() => {
  mocks.role = 'photographer';
  mocks.fetchOverview.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});

afterEach(() => {
  cleanup();
  client.clear();
  vi.useRealTimers();
});

describe('dashboard overview refresh authorization', () => {
  it('does not fetch the admin overview for a photographer after manual or upload refresh', async () => {
    const { result } = renderHook(() => useDashboardOverview(), { wrapper });
    await act(async () => { await result.current.refresh(); });
    await refreshThroughRealtime();
    expect(mocks.fetchOverview).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it.each(['admin', 'superadmin', 'editing_manager'])('still refreshes the overview for %s', async (role) => {
    mocks.role = role;
    const { result } = renderHook(() => useDashboardOverview(), { wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const initialCalls = mocks.fetchOverview.mock.calls.length;
    await act(async () => { await result.current.refresh(); });
    expect(mocks.fetchOverview.mock.calls.length).toBeGreaterThan(initialCalls);
    const manualCalls = mocks.fetchOverview.mock.calls.length;
    await refreshThroughRealtime();
    expect(mocks.fetchOverview.mock.calls.length).toBeGreaterThan(manualCalls);
  });

  it('unregisters overview refresh when switching from admin to photographer', async () => {
    mocks.role = 'admin';
    const { result, rerender } = renderHook(() => useDashboardOverview(), { wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    mocks.role = 'photographer';
    rerender();
    const previousCalls = mocks.fetchOverview.mock.calls.length;
    await act(async () => { await result.current.refresh(); });
    await refreshThroughRealtime();
    expect(mocks.fetchOverview).toHaveBeenCalledTimes(previousCalls);
  });
});
