import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canViewAryeoRequests, useAryeoRequests } from './useAryeoRequests';

const response = (id: number) => ({ ok: true, json: async () => ({ data: [{ id, address: `Property ${id}` }], meta: { total: 1, pendingCount: 1, page: 1, lastPage: 1 }, connections: [] }) });
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Aryeo request discovery view', () => {
  it.each(['admin', 'superadmin', 'editing_manager', 'salesRep', 'rep'])('allows the %s request category', role => expect(canViewAryeoRequests(role)).toBe(true));
  it.each(['client', 'photographer', 'editor'])('hides the category for %s', role => expect(canViewAryeoRequests(role)).toBe(false));

  it('automatically loads new requests on the polling interval without a reload', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(response(13)).mockResolvedValue(response(14));
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useAryeoRequests(true, 'admin:1'), { wrapper: wrapper() });
    await act(async () => vi.advanceTimersByTimeAsync(10));
    expect(result.current.requests[0]?.id).toBe(13);
    await act(async () => vi.advanceTimersByTimeAsync(30_010));
    expect(result.current.requests[0]?.id).toBe(14);
  });

  it('does not fetch while unauthorized and immediately isolates account switches from late replies', async () => {
    let finishAdmin!: (value: unknown) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishAdmin = resolve; })).mockResolvedValue(response(8));
    vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(({ enabled, scope }) => useAryeoRequests(enabled, scope), {
      wrapper: wrapper(), initialProps: { enabled: false, scope: 'client:4' },
    });
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ enabled: true, scope: 'admin:1' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ enabled: true, scope: 'salesRep:8' });
    expect(result.current.requests).toEqual([]);
    await waitFor(() => expect(result.current.requests[0]?.id).toBe(8));
    await act(async () => finishAdmin(response(99)));
    expect(result.current.requests[0]?.id).toBe(8);
    rerender({ enabled: false, scope: 'client:4' });
    expect(result.current.requests).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
  });

  it('shows fetch failures and reloads the selected delivered history', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue(response(12));
    vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(({ history }) => useAryeoRequests(true, 'admin:1', history), { wrapper: wrapper(), initialProps: { history: false } });
    await waitFor(() => expect(result.current.error).toContain('Unable to load'));
    rerender({ history: true });
    await waitFor(() => expect(result.current.requests[0]?.id).toBe(12));
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('history=1'), expect.anything());
  });
});
