import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCancellationRequests } from './useCancellationRequests';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('cancellation request reviewers', () => {
  it('loads requests for an authorized sales reviewer and forwards the fee decision', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 89, address: '89 Test Lane', client: { name: 'Client' } }] }) });
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useCancellationRequests({ canReviewCancellationRequests: true, viewerScope: 'salesRep:9', refresh: vi.fn(), toast: vi.fn() }));
    await waitFor(() => expect(result.current.cancellationRequestCount).toBe(1));
    expect(result.current.cancellationShoots[0]).toMatchObject({ id: 89, address: '89 Test Lane' });
    await act(() => result.current.handleApproveCancellation(89, 'waive_fee'));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/shoots/89/approve-cancellation'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ decision: 'waive_fee' }) }));
  });

  it('does not load or expose review requests for a photographer', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useCancellationRequests({ canReviewCancellationRequests: false, viewerScope: 'photographer:3', pendingCancellations: [{ id: 89, address: '89 Test Lane' }], refresh: vi.fn(), toast: vi.fn() }));
    await act(() => result.current.fetchPendingCancellationShoots());
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.cancellationRequestCount).toBe(0);
  });

  it('reloads for a different reviewer and ignores a late response from the previous account', async () => {
    let finishAdmin!: (response: unknown) => void;
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishAdmin = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 9, address: 'Rep property' }] }) }));
    const { result, rerender } = renderHook(({ viewerScope }) => useCancellationRequests({ canReviewCancellationRequests: true, viewerScope, refresh: vi.fn(), toast: vi.fn() }), { initialProps: { viewerScope: 'admin:1' } });
    rerender({ viewerScope: 'salesRep:9' });
    await waitFor(() => expect(result.current.cancellationShoots.map((item) => item.id)).toEqual([9]));
    await act(async () => finishAdmin({ ok: true, json: async () => ({ data: [{ id: 100, address: 'Other client property' }] }) }));
    expect(result.current.cancellationShoots.map((item) => item.id)).toEqual([9]);
  });
});
