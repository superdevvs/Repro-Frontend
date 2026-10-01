import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorDashboardQueue } from './useEditorDashboardQueue';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get } }));

const record = (id: number, status = 'editing') => ({
  id, status, workflow_status: status, scheduled_date: '2026-08-01', address: `Property ${id}`,
});
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider
  client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
>{children}</QueryClientProvider>;

beforeEach(() => { mocks.get.mockReset(); });
afterEach(cleanup);

describe('editor dashboard operational pagination', () => {
  it('loads all active pages and only the first delivered page', async () => {
    mocks.get.mockImplementation(async (_path, { params }) => ({ data: {
      data: params.tab === 'completed' ? [record(params.page), record(1)] : [record(200, 'delivered')],
      meta: { last_page: params.tab === 'completed' ? 3 : 20 },
    } }));
    const { result } = renderHook(() => useEditorDashboardQueue(7, true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.upcomingShoots.map(shoot => shoot.id)).toEqual(['1', '2', '3']);
    expect(result.current.deliveredShoots.map(shoot => shoot.id)).toEqual(['200']);
    expect(mocks.get.mock.calls.filter(([, config]) => config.params.tab === 'delivered')).toHaveLength(1);
    expect(mocks.get.mock.calls.every(([, config]) => config.signal instanceof AbortSignal)).toBe(true);
  });

  it('does not publish an incomplete active queue after a later page fails', async () => {
    mocks.get.mockImplementation(async (_path, { params }) => {
      if (params.tab === 'completed' && params.page === 2) throw new Error('Network failed');
      return { data: { data: [record(1)], meta: { last_page: 2 } } };
    });
    const { result } = renderHook(() => useEditorDashboardQueue(7, true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.upcomingShoots).toEqual([]);
  });

  it('keeps ready work in the active queue without duplicating it as delivered', async () => {
    mocks.get.mockResolvedValue({ data: { data: [record(42, 'ready')], meta: { last_page: 1 } } });
    const { result } = renderHook(() => useEditorDashboardQueue(7, true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.upcomingShoots.map(shoot => shoot.id)).toEqual(['42']);
    expect(result.current.deliveredShoots).toEqual([]);
  });

  it('retains globally delivered work only for the current editor unfinished media lane', async () => {
    const delivered = (id: number, editorId: number, ready: boolean) => ({
      ...record(id, 'delivered'), editor_assignments: [{ lane: 'video', editor_id: editorId, ready }],
    });
    mocks.get.mockResolvedValue({ data: {
      data: [delivered(1, 7, false), delivered(2, 7, true), delivered(3, 8, false)], meta: { last_page: 1 },
    } });
    const { result } = renderHook(() => useEditorDashboardQueue(7, true), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.upcomingSummaries.map(shoot => [shoot.id, shoot.hasPendingEditorWork])).toEqual([[1, true]]);
    expect(result.current.deliveredShoots.map(shoot => shoot.id)).toEqual(['2', '3']);
    expect(mocks.get.mock.calls.find(([, config]) => config.params.tab === 'completed')?.[1].params.dashboard_open).toBe(true);
  });

  it('does not fetch for a disabled role', async () => {
    const { result } = renderHook(() => useEditorDashboardQueue(7, false), { wrapper });
    expect(result.current.upcomingShoots).toEqual([]);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
